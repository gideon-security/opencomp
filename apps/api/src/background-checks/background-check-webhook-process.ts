import { BadRequestException } from '@nestjs/common';
import { BackgroundCheckStatus, db, Prisma } from '@db';
import {
  isTerminalBackgroundCheckStatus,
  shouldWriteWebhookStatus,
} from './background-checks.types';

/**
 * Transactional webhook write. Separated from background-check-webhook.ts
 * (event persistence) to keep both files under the 300-line limit.
 *
 * The report snapshot arrives pre-fetched (see applyWebhookEvent): network
 * I/O inside an interactive transaction holds database locks across vendor
 * latency and trips the transaction timeout.
 */
export async function processWebhookEvent({
  record,
  eventId,
  payloadId,
  candidateId,
  isReportEvent,
  status,
  rawStatus,
  candidateName,
  candidateEmail,
  statuses,
  reportSnapshot,
}: {
  record: {
    id: string;
    status: BackgroundCheckStatus;
    employeeName: string;
    employeeEmail: string;
    identityBackgroundCheckId: string | null;
    checkrInvitationId: string | null;
  };
  eventId: string;
  payloadId: string;
  candidateId?: string;
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
  reportSnapshot: Prisma.InputJsonValue | null;
}): Promise<{ ok: true; duplicate?: true }> {
  return db.$transaction(async (tx) => {
    // Re-read inside the transaction: the terminal check and the update
    // must see the latest row, not the pre-insert snapshot, or a
    // concurrent sync/reconcile can regress a finished check.
    const current = await tx.backgroundCheckRequest.findUnique({
      where: { id: record.id },
    });
    if (!current) {
      throw new BadRequestException('Background check request not found.');
    }

    // Terminal rows are frozen. Without this, a late or replayed in-flight
    // event regresses a finished check back to a non-terminal status.
    if (isTerminalBackgroundCheckStatus(current.status)) {
      return { ok: true };
    }

    // Invitation events describe the hosted flow (created/completed/expired),
    // not the report. They may advance in-flight state but must never
    // terminalize the row — except an expired or deleted invitation on a
    // still-invited row (see shouldWriteWebhookStatus). A null status
    // (status-less event) never writes: there is no transition to apply.
    const writeStatus = shouldWriteWebhookStatus({
      isReportEvent,
      status,
      recordStatus: current.status,
      rawStatus,
    });

    await tx.backgroundCheckRequest.update({
      where: { id: record.id },
      data: {
        // Only report events graduate the pointer. Invitation events carry
        // an invitation id that getReport cannot resolve.
        ...(isReportEvent ? { identityBackgroundCheckId: payloadId } : {}),
        ...(candidateId ? { checkrCandidateId: candidateId } : {}),
        employeeName: candidateName ?? current.employeeName,
        employeeEmail: candidateEmail ?? current.employeeEmail,
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
  });
}
