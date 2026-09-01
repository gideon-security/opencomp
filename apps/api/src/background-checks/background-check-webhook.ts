import { BadRequestException } from '@nestjs/common';
import { BackgroundCheckStatus, db, Prisma } from '@db';
import type { BackgroundCheckIdentityClient } from './background-check-identity.client';
import { fetchCompletedReportSnapshot } from './background-check-report-snapshot';
import { verifyBackgroundCheckWebhookSignature } from './background-check-webhook-signature';
import {
  deriveWebhookEventIdentity,
  resolveWebhookRecord,
} from './background-check-webhook-resolve';
import {
  backgroundCheckStatuses,
  checkrWebhookPayloadSchema,
  isTerminalBackgroundCheckStatus,
  mapCheckrReportToStatus,
} from './background-checks.types';

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

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
  const isReportEvent = !data.object || data.object === 'report';

  const { eventId, eventType } = deriveWebhookEventIdentity({
    headers,
    envelopeId: (parsed as { id?: string }).id,
    envelopeType: (parsed as { type?: string }).type,
    reportId,
  });

  const record = await resolveWebhookRecord({
    reportId,
    candidateId,
    metadata: data.metadata,
  });

  // A status-less event carries no state transition: record it, resolve the
  // row, but leave the status alone. Unknown non-empty statuses still 400 so
  // vendor drift surfaces loudly (the dedup key makes the retry safe).
  const mappedStatus = mapCheckrReportToStatus(data);
  if (
    mappedStatus !== '' &&
    !(backgroundCheckStatuses as readonly string[]).includes(mappedStatus)
  ) {
    throw new BadRequestException(
      'Checkr sent a status this version does not recognize.',
    );
  }

  return processWebhookEvent({
    record,
    eventId,
    eventType,
    payloadId: reportId,
    candidateId,
    isReportEvent,
    status: mappedStatus === '' ? null : (mappedStatus as BackgroundCheckStatus),
    candidateName: data.candidateName,
    candidateEmail: data.candidateEmail,
    statuses: data.statuses,
    rawPayload: rawJson,
    identityClient,
  });
}

export async function processWebhookEvent({
  record,
  eventId,
  eventType,
  payloadId,
  candidateId,
  isReportEvent,
  status,
  candidateName,
  candidateEmail,
  statuses,
  rawPayload,
  identityClient,
}: {
  record: {
    id: string;
    status: BackgroundCheckStatus;
    employeeName: string;
    employeeEmail: string;
  };
  eventId: string;
  eventType: string;
  payloadId: string;
  candidateId?: string;
  isReportEvent: boolean;
  status: BackgroundCheckStatus | null;
  candidateName?: string;
  candidateEmail?: string;
  statuses?: {
    identity?: string;
    employment?: string;
    references?: string;
    rightToWork?: string;
    adjudication?: string;
  };
  rawPayload: unknown;
  identityClient: BackgroundCheckIdentityClient;
}): Promise<{ ok: true; duplicate?: true }> {
  try {
    await db.backgroundCheckWebhookEvent.create({
      data: {
        eventId,
        eventType,
        backgroundCheckRequestId: record.id,
        identityBackgroundCheckId: payloadId,
        payload: rawPayload as Prisma.InputJsonValue,
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

  // Terminal rows are frozen. Without this, a late or replayed in-flight
  // event regresses a finished check back to a non-terminal status.
  if (isTerminalBackgroundCheckStatus(record.status)) {
    return { ok: true };
  }

  // Invitation events describe the hosted flow (created/completed/expired),
  // not the report. They may advance in-flight state but must never
  // terminalize the row: an invitation "completed" only means the candidate
  // finished the form, and the report still has to arrive. A null status
  // (status-less event) never writes: there is no transition to apply.
  const writeStatus =
    status !== null &&
    (isReportEvent || !isTerminalBackgroundCheckStatus(status));
  const effectiveStatus = writeStatus && status ? status : record.status;

  const reportSnapshot = await fetchCompletedReportSnapshot({
    identityClient,
    identityBackgroundCheckId: payloadId,
    eventType,
    status: effectiveStatus,
  });

  await db.backgroundCheckRequest.update({
    where: { id: record.id },
    data: {
      // Only report events graduate the pointer. Invitation events carry
      // an invitation id that getReport cannot resolve.
      ...(isReportEvent ? { identityBackgroundCheckId: payloadId } : {}),
      ...(candidateId ? { checkrCandidateId: candidateId } : {}),
      employeeName: candidateName ?? record.employeeName,
      employeeEmail: candidateEmail ?? record.employeeEmail,
      ...(writeStatus && status ? { status } : {}),
      // Only overwrite sub-statuses when the payload carries them. Writing
      // null unconditionally would wipe previously stored values on events
      // that carry no sub-statuses.
      ...(statuses?.identity !== undefined
        ? { identityStatus: statuses.identity }
        : {}),
      ...(statuses?.employment !== undefined
        ? { employmentStatus: statuses.employment }
        : {}),
      ...(statuses?.references !== undefined
        ? { referenceStatus: statuses.references }
        : {}),
      ...(statuses?.rightToWork !== undefined
        ? { rightToWorkStatus: statuses.rightToWork }
        : {}),
      ...(statuses?.adjudication !== undefined
        ? { adjudicationStatus: statuses.adjudication }
        : {}),
      lastWebhookEventId: eventId,
      lastSyncedAt: new Date(),
      ...(reportSnapshot
        ? {
            reportSnapshot,
            reportSyncedAt: new Date(),
          }
        : {}),
    },
  });

  return { ok: true };
}
