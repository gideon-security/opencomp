import { BadRequestException } from '@nestjs/common';
import { BackgroundCheckStatus } from '@db';
import type { CheckrClient } from './checkr.client';
import { applyWebhookEvent } from './background-check-webhook-apply';
import {
  ackWebhookDedupMarker,
  releaseWebhookDedupMarker,
} from './background-check-webhook-dedup';
import { claimWebhookDedupMarker } from './background-check-webhook-claim';
import { verifyCheckrWebhookSignature } from './background-check-webhook-signature';
import {
  deriveWebhookEventIdentity,
  fingerprintReport,
  WEBHOOK_FUTURE_SKEW_MS,
  WEBHOOK_MAX_AGE_MS,
  webhookEventAgeMs,
  webhookEventTimeMs,
} from './background-check-webhook-resolve';
import {
  backgroundCheckStatuses,
  checkrWebhookPayloadSchema,
  mapCheckrReportToStatus,
} from './background-checks.types';

export { isUniqueConstraintError } from './background-check-webhook-dedup';

/**
 * True when the failure is a missing operator configuration (e.g. no
 * CHECKR_API_KEY), not a malformed payload. A completion webhook that
 * arrives before the key is configured must release the marker and retry
 * later — acking it as permanent would drop the transition and redeliveries
 * would ack duplicate once the key exists.
 */
function isMissingConfigurationError(error: BadRequestException): boolean {
  return error.message.includes('not configured');
}

export async function handleCheckrWebhookRequest({
  rawBody,
  headers,
  identityClient,
}: {
  rawBody: Buffer | undefined;
  headers: Record<string, string | string[] | undefined>;
  identityClient: CheckrClient;
}): Promise<{ ok: true; duplicate?: true }> {
  if (!rawBody) {
    throw new BadRequestException('Raw body unavailable.');
  }

  verifyCheckrWebhookSignature({ rawBody, headers });
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
    identityClient: CheckrClient;
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

  // Replay guard BEFORE the dedup insert. Freshness comes from the payload's
  // own event time (Checkr sends no delivery timestamp). A rejection here
  // 400s on every delivery and never touches the dedup key — a captured
  // delivery replayed past the window can never apply, while missed updates
  // still heal through sync and reconcile. Future-dated payloads are
  // rejected too: a negative age never exceeds the max and would stay fresh
  // forever.
  const eventAgeMs = webhookEventAgeMs(data);
  if (
    eventAgeMs !== null &&
    (eventAgeMs > WEBHOOK_MAX_AGE_MS || eventAgeMs < -WEBHOOK_FUTURE_SKEW_MS)
  ) {
    throw new BadRequestException('Checkr webhook delivery is too old.');
  }

  const { eventId, eventType } = deriveWebhookEventIdentity({
    headers,
    envelopeId: (parsed as { id?: string }).id,
    envelopeType: (parsed as { type?: string }).type,
    reportId,
    reportFingerprint: fingerprintReport(data),
  });

  // Claim the event row BEFORE resolving or validating. A replay then hits
  // the unique key and acks as duplicate without re-running anything. The
  // request link is filled in below. Permanent failures (tenant mismatch)
  // mark the row applied on the way out (see below) so the vendor's retry
  // acks instead of throwing forever. Transient failures delete the marker
  // again (see below) so the retry reprocesses instead of acking
  // duplicate on state that was never applied. A marker from a crashed
  // worker (old, never applied, never linked) is reclaimed and reprocessed.
  const claim = await claimWebhookDedupMarker({
    eventId,
    eventType,
    reportId,
    rawJson,
  });
  if (claim === 'duplicate') {
    return { ok: true, duplicate: true };
  }

  try {
    return await applyWebhookEvent({
      reportId,
      candidateId,
      metadata: data.metadata,
      eventId,
      eventType,
      eventTimeMs: webhookEventTimeMs(data),
      isReportEvent,
      status,
      rawStatus: data.status,
      candidateName: data.candidateName,
      candidateEmail: data.candidateEmail,
      statuses: data.statuses,
      identityClient,
    });
  } catch (error) {
    if (
      error instanceof BadRequestException &&
      !isMissingConfigurationError(error)
    ) {
      // Permanent: the payload can never apply (tenant mismatch). Ack the
      // marker so retries ack duplicate instead of throwing forever.
      // Without this the row stays old, unapplied, and unlinked — exactly
      // the reclaim predicate — and every redelivery past the stale window
      // reprocesses just to 400 again.
      await ackWebhookDedupMarker(eventId);
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
