import { BadRequestException } from '@nestjs/common';
import { BackgroundCheckStatus, db, Prisma } from '@db';
import {
  isTerminalBackgroundCheckStatus,
  normalizeWebhookEmail,
  shouldWriteWebhookStatus,
} from './background-checks.types';
import {
  isStaleIndirectEvent,
  webhookEventTimeMs,
  type WebhookResolutionVia,
} from './background-check-webhook-resolve';

/**
 * Transactional webhook write. Separated from background-check-webhook.ts
 * (event persistence) to keep both files under the 300-line limit.
 *
 * The report snapshot arrives pre-fetched (see applyWebhookEvent): network
 * I/O inside an interactive transaction holds database locks across vendor
 * latency and trips the transaction timeout.
 *
 * The row write carries a status-plus-pointer-plus-watermark predicate: a
 * concurrent delivery, sync, or retry that moved the row between the re-read
 * and the write must win instead of being clobbered by stale state. The
 * pointer matters because sync graduates invitation → report without
 * touching the watermark or the status. A lost race re-reads and re-decides
 * on fresh state (at most once) before giving up transiently so the vendor
 * retry reprocesses.
 */

type TxClient = Omit<
  typeof db,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

type WebhookRow = {
  id: string;
  status: BackgroundCheckStatus;
  employeeName: string;
  employeeEmail: string;
  identityBackgroundCheckId: string | null;
  checkrInvitationId: string | null;
  supersededIdentityBackgroundCheckIds: string[];
  lastWebhookEventId: string | null;
};

/** Mark the event applied in the same transaction as the row write. */
async function markEventApplied({
  tx,
  recordId,
  eventId,
}: {
  tx: TxClient;
  recordId: string;
  eventId: string;
}): Promise<void> {
  // A crash before this commit leaves appliedAt null, so the next delivery
  // reprocesses instead of acking duplicate on state that was never written.
  // The request link lands here too — never ahead of the commit, or a crash
  // between the link and the commit would leave a linked-but-unapplied
  // marker that the reclaim predicate can never pick up.
  await tx.backgroundCheckWebhookEvent.updateMany({
    where: { eventId, appliedAt: null },
    data: { backgroundCheckRequestId: recordId, appliedAt: new Date() },
  });
}

/** True when this delivery is older than the row's current watermark. */
async function isOutdatedDelivery({
  tx,
  row,
  eventId,
  eventTimeMs,
}: {
  tx: TxClient;
  row: WebhookRow;
  eventId: string;
  /** Vendor event time of this delivery; null when the payload has none. */
  eventTimeMs: number | null;
}): Promise<boolean> {
  // Missing timestamps on either side fail open and apply.
  if (
    eventTimeMs === null ||
    !row.lastWebhookEventId ||
    row.lastWebhookEventId === eventId
  ) {
    return false;
  }
  const previous = await tx.backgroundCheckWebhookEvent.findUnique({
    where: { eventId: row.lastWebhookEventId },
  });
  const previousTimeMs = webhookEventTimeMs(previous?.payload);
  return previousTimeMs !== null && eventTimeMs < previousTimeMs;
}

export async function processWebhookEvent({
  record,
  eventId,
  eventTimeMs,
  payloadId,
  candidateId,
  isReportEvent,
  status,
  rawStatus,
  candidateName,
  candidateEmail,
  statuses,
  reportSnapshot,
  via,
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
  /** Vendor event time of this delivery; null when the payload has none. */
  eventTimeMs: number | null;
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
  via: WebhookResolutionVia;
}): Promise<{ ok: true; duplicate?: true }> {
  return db.$transaction(async (tx) => {
    // Re-read inside the transaction: every decision below must see the
    // latest row, not the pre-insert snapshot, or a concurrent sync,
    // retry, or delivery regresses a finished check.
    let row = (await tx.backgroundCheckRequest.findUnique({
      where: { id: record.id },
    })) as unknown as WebhookRow | null;
    if (!row) {
      throw new BadRequestException('Background check request not found.');
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      // Terminal rows are frozen: a late or replayed in-flight event must
      // never move a finished check back to a non-terminal status. The
      // marker is still marked applied so a redelivery acks duplicate.
      if (isTerminalBackgroundCheckStatus(row.status)) {
        await markEventApplied({ tx, recordId: record.id, eventId });
        return { ok: true };
      }

      // Re-derive `via` from the in-transaction row: a retry may have
      // swapped the pointer while this delivery waited (e.g. during the
      // pre-transaction snapshot fetch), and a `direct` resolution from
      // before the swap must not skip the stale guard on the new pointer.
      // Any non-direct value behaves the same in the guard below.
      const effectiveVia: WebhookResolutionVia =
        row.identityBackgroundCheckId === payloadId ? via : 'candidate';

      // Re-evaluate staleness on the in-transaction row: a retry may have
      // swapped the pointer while this delivery waited, which flips the
      // stale verdict either way.
      if (
        isStaleIndirectEvent({
          via: effectiveVia,
          isReportEvent,
          record: row,
          reportId: payloadId,
        }) ||
        (await isOutdatedDelivery({ tx, row, eventId, eventTimeMs }))
      ) {
        await markEventApplied({ tx, recordId: record.id, eventId });
        return { ok: true };
      }

      // A non-report (invitation) event naming an invitation that is
      // neither the row's current pointer nor its current invitation
      // belongs to a prior attempt: a retry swapped in a fresh invitation
      // while this delivery waited. The expired/deleted exception in
      // shouldWriteWebhookStatus would otherwise terminalize the new
      // attempt. Gated on terminal statuses so candidate events (which
      // carry no status) keep syncing name and email below.
      if (
        !isReportEvent &&
        status !== null &&
        isTerminalBackgroundCheckStatus(status) &&
        payloadId !== row.identityBackgroundCheckId &&
        payloadId !== row.checkrInvitationId
      ) {
        await markEventApplied({ tx, recordId: record.id, eventId });
        return { ok: true };
      }

      // Invitation events describe the hosted flow (created/completed/
      // expired), not the report. They may advance in-flight state but must
      // never terminalize the row — except an expired or deleted invitation
      // on a still-invited row (see shouldWriteWebhookStatus). A null status
      // (status-less event) never writes: there is no transition to apply.
      const writeStatus = shouldWriteWebhookStatus({
        isReportEvent,
        status,
        recordStatus: row.status,
        rawStatus,
      });
      const written = await tx.backgroundCheckRequest.updateMany({
        where: {
          id: row.id,
          status: row.status,
          // Guard the pointer too: sync graduates invitation → report (and
          // retry swaps it) without touching status or watermark. Without
          // this a sync commit in the check→write window goes undetected and
          // this write clobbers the fresh pointer with stale state.
          identityBackgroundCheckId: row.identityBackgroundCheckId,
          lastWebhookEventId: row.lastWebhookEventId,
        },
        data: {
          // Only report events graduate the pointer. Invitation events carry
          // an invitation id that getReport cannot resolve.
          ...(isReportEvent ? { identityBackgroundCheckId: payloadId } : {}),
          ...(candidateId ? { checkrCandidateId: candidateId } : {}),
          employeeName: candidateName ?? row.employeeName,
          employeeEmail: normalizeWebhookEmail({
            candidateEmail,
            currentEmail: row.employeeEmail,
          }),
          ...(writeStatus && status ? { status } : {}),
          // Only overwrite sub-statuses when the payload carries them.
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
      if (written.count > 0) {
        await markEventApplied({ tx, recordId: record.id, eventId });
        return { ok: true };
      }

      // Lost a race inside the transaction: re-read and let the next
      // attempt re-decide on fresh state instead of clobbering the winner.
      row = await tx.backgroundCheckRequest.findUnique({
        where: { id: record.id },
      });
      if (!row) {
        throw new BadRequestException('Background check request not found.');
      }
    }

    // Still churning under concurrent writers: fail transiently so the
    // caller releases the marker and the vendor retry reprocesses, instead
    // of committing a twice-stale transition.
    throw new Error(
      'Background check changed while applying the webhook event.',
    );
  });
}
