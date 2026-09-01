import { BadRequestException, Logger } from '@nestjs/common';
import { BackgroundCheckStatus, db, Prisma } from '@db';
import type { BackgroundCheckIdentityClient } from './background-check-identity.client';
import { fetchCompletedReportSnapshot } from './background-check-report-snapshot';
import {
  isUniqueConstraintError,
  releaseWebhookDedupMarker,
} from './background-check-webhook-dedup';
import { processWebhookEvent } from './background-check-webhook-process';
import { verifyBackgroundCheckWebhookSignature } from './background-check-webhook-signature';
import {
  deriveWebhookEventIdentity,
  fingerprintReport,
  isStaleIndirectEvent,
  resolveWebhookRecord,
  WEBHOOK_MAX_AGE_MS,
  webhookEventAgeMs,
} from './background-check-webhook-resolve';
import {
  backgroundCheckStatuses,
  checkrWebhookPayloadSchema,
  mapCheckrReportToStatus,
  shouldWriteWebhookStatus,
} from './background-checks.types';

const logger = new Logger('CheckrWebhook');

export { isUniqueConstraintError } from './background-check-webhook-dedup';

export async function handleCheckrWebhookRequest({
  rawBody,
  headers,
  identityClient,
}: {
  rawBody: Buffer | undefined;
  headers: Record<string, string | string[] | undefined>;
  identityClient: BackgroundCheckIdentityClient;
}): Promise<{ ok: true; duplicate?: true }> {
  if (!rawBody) {
    throw new BadRequestException('Raw body unavailable.');
  }

  verifyBackgroundCheckWebhookSignature({ rawBody, headers });
  let rawJson: unknown;
  try {
    rawJson = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw new BadRequestException('Invalid Checkr webhook payload');
  }

  const checkrParsed = checkrWebhookPayloadSchema.safeParse(rawJson);
  if (!checkrParsed.success) {
    throw new BadRequestException('Invalid Checkr webhook payload');
  }

  return handleCheckrWebhook(checkrParsed.data, headers, rawJson, {
    identityClient,
  });
}

async function handleCheckrWebhook(
  parsed: ReturnType<typeof checkrWebhookPayloadSchema.parse>,
  headers: Record<string, string | string[] | undefined>,
  rawJson: unknown,
  {
    identityClient,
  }: {
    identityClient: BackgroundCheckIdentityClient;
  },
): Promise<{ ok: true; duplicate?: true }> {
  const data = parsed.data as {
    id: string;
    object?: string;
    status?: string;
    candidate_id?: string;
    candidateName?: string;
    candidateEmail?: string;
    adjudication?: string;
    updatedAt?: number | null;
    completedAt?: number | null;
    metadata?: {
      compOrganizationId?: string;
      compMemberId?: string;
    };
    statuses?: {
      identity?: string;
      employment?: string;
      references?: string;
      rightToWork?: string;
      adjudication?: string;
    };
  };
  const reportId = data.id;
  const candidateId = data.candidate_id;
  // Only report objects carry the report id. Invitation events arrive with
  // an invitation id in data.id and must not overwrite the report pointer.
  const isReportEvent = data.object === 'report';

  // Validate the vendor status BEFORE the dedup insert. A rejection here
  // 400s on every delivery and never touches the dedup key, so a retry can
  // still apply once the vendor payload is understood. (Unreachable today:
  // mapCheckrReportToStatus only returns known statuses or '' — this stays
  // as a guard so a future mapper change fails loudly instead of writing
  // a fabricated state.)
  const mappedStatus = mapCheckrReportToStatus(data);
  if (
    mappedStatus !== '' &&
    !(backgroundCheckStatuses as readonly string[]).includes(mappedStatus)
  ) {
    throw new BadRequestException(
      'Checkr sent a status this version does not recognize.',
    );
  }
  const status: BackgroundCheckStatus | null =
    mappedStatus === '' ? null : (mappedStatus as BackgroundCheckStatus);

  // Replay guard BEFORE the dedup insert. Checkr sends no delivery timestamp,
  // so freshness comes from the payload's event time. A rejection here 400s
  // on every delivery and never touches the dedup key — a captured delivery
  // replayed past the window can never apply, while missed updates still
  // heal through sync and reconcile.
  const eventAgeMs = webhookEventAgeMs(data);
  if (eventAgeMs !== null && eventAgeMs > WEBHOOK_MAX_AGE_MS) {
    throw new BadRequestException('Checkr webhook delivery is too old.');
  }

  const { eventId, eventType } = deriveWebhookEventIdentity({
    headers,
    envelopeId: (parsed as { id?: string }).id,
    envelopeType: (parsed as { type?: string }).type,
    reportId,
    reportFingerprint: fingerprintReport(data),
  });

  // Insert the event row BEFORE resolving or validating. A replay then hits
  // the unique key and acks as duplicate without re-running anything. The
  // request link is filled in below. Permanent failures (unknown row,
  // tenant mismatch) keep this row as a poison marker so the vendor's
  // retry acks instead of throwing forever. Transient failures delete it
  // again (see below) so the retry reprocesses instead of acking
  // duplicate on state that was never applied.
  try {
    await db.backgroundCheckWebhookEvent.create({
      data: {
        eventId,
        eventType,
        identityBackgroundCheckId: reportId,
        payload: rawJson as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      // Replay: the event already applied once. Acknowledge without
      // writing so a stale redelivery cannot regress current state.
      return { ok: true, duplicate: true };
    }
    throw error;
  }

  try {
    return await applyWebhookEvent({
      reportId,
      candidateId,
      metadata: data.metadata,
      eventId,
      eventType,
      isReportEvent,
      status,
      rawStatus: data.status,
      candidateName: data.candidateName,
      candidateEmail: data.candidateEmail,
      statuses: data.statuses,
      identityClient,
    });
  } catch (error) {
    if (error instanceof BadRequestException) {
      // Permanent: the payload can never apply (tenant mismatch, unknown
      // status). Keep the poison marker so retries ack instead of throwing.
      throw error;
    }
    // Unknown row or transient failure: the row may appear later (a webhook
    // that beat the request write, a first report for an ungraduated
    // pointer) or the outage may pass. Release the marker so the vendor
    // retry re-runs the whole event instead of acking duplicate on state
    // that was never applied.
    await releaseWebhookDedupMarker(eventId);
    throw error;
  }
}

async function applyWebhookEvent({
  reportId,
  candidateId,
  metadata,
  eventId,
  eventType,
  isReportEvent,
  status,
  rawStatus,
  candidateName,
  candidateEmail,
  statuses,
  identityClient,
}: {
  reportId: string;
  candidateId?: string;
  metadata?: {
    compOrganizationId?: string;
    compMemberId?: string;
  };
  eventId: string;
  eventType: string;
  isReportEvent: boolean;
  status: BackgroundCheckStatus | null;
  rawStatus?: string;
  candidateName?: string;
  candidateEmail?: string;
  statuses?: {
    identity?: string;
    employment?: string;
    references?: string;
    rightToWork?: string;
    adjudication?: string;
  };
  identityClient: BackgroundCheckIdentityClient;
}): Promise<{ ok: true; duplicate?: true }> {
  const { record, via } = await resolveWebhookRecord({
    reportId,
    candidateId,
    metadata,
  });
  await db.backgroundCheckWebhookEvent.updateMany({
    where: { eventId },
    data: { backgroundCheckRequestId: record.id },
  });

  // An indirectly resolved report event must never rewind a graduated
  // pointer (see isStaleIndirectEvent): a late event for a superseded
  // report still matches via fallback after a retry swapped in a check.
  if (
    isStaleIndirectEvent({ via, isReportEvent, record, reportId: reportId })
  ) {
    logger.warn('Ignoring stale indirect webhook event', {
      eventId,
      via,
      backgroundCheckRequestId: record.id,
    });
    return { ok: true };
  }

  // Invitation events describe the hosted flow (created/completed/expired),
  // not the report. They may advance in-flight state but must never
  // terminalize the row — except an expired or deleted invitation on a
  // still-invited row, which can never produce a report (see
  // shouldWriteWebhookStatus). A null status (status-less event) never
  // writes: there is no transition to apply.
  const writeStatus = shouldWriteWebhookStatus({
    isReportEvent,
    status,
    recordStatus: record.status,
    rawStatus,
  });
  const effectiveStatus = writeStatus && status ? status : record.status;

  // Fetch the report snapshot BEFORE the transaction below. Network I/O
  // must never run inside an interactive transaction: a slow vendor
  // response holds database locks and trips the transaction timeout.
  // The fetch is best-effort and may go unused (e.g. the row turns out to
  // be terminal inside the transaction) — that costs one read, not a
  // stuck transaction.
  const reportSnapshot = await fetchCompletedReportSnapshot({
    identityClient,
    identityBackgroundCheckId: reportId,
    invitationId: record.checkrInvitationId,
    eventType,
    status: effectiveStatus,
  });

  return processWebhookEvent({
    record,
    eventId,
    payloadId: reportId,
    candidateId,
    isReportEvent,
    status,
    rawStatus,
    candidateName,
    candidateEmail,
    statuses,
    reportSnapshot,
  });
}
