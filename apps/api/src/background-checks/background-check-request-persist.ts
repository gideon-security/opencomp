import { Logger, NotFoundException } from '@nestjs/common';
import { BackgroundCheckStatus, db } from '@db';
import {
  isTerminalBackgroundCheckStatus,
  terminalBackgroundCheckStatuses,
} from './background-checks.types';
import type { BackgroundCheckPaymentService } from './background-check-payment.service';
import { refundBestEffort } from './background-check-compensation';

const logger = new Logger('BackgroundCheckRequestPersist');

const terminalStatuses = [
  ...terminalBackgroundCheckStatuses,
] as BackgroundCheckStatus[];

type IdentityResult = {
  id: string;
  status: BackgroundCheckStatus;
  candidateId?: string | null;
  invitationId?: string | null;
  candidateUrl?: string | null;
};

/**
 * Guarded failed-mark for the request flow. The terminal-excluding predicate
 * keeps compensation from dragging a finished check back to failed: a report
 * webhook may terminalize the row while the vendor call is in flight, and a
 * concurrent retry swap must win over this attempt's mark. A lost race only
 * logs — the winner owns the row.
 */
export async function markRequestFailed({
  createdId,
  organizationId,
  memberId,
  refundId,
  step,
}: {
  createdId: string;
  organizationId: string;
  memberId: string;
  refundId: string | null;
  step: 'checkr-create' | 'persist-ids';
}): Promise<void> {
  const marked = await db.backgroundCheckRequest
    .updateMany({
      // Keyed by record id plus the null pointer so a concurrent retry swap
      // wins, plus a terminal exclusion so a finished check stays finished.
      where: {
        id: createdId,
        identityBackgroundCheckId: null,
        status: { notIn: terminalStatuses },
      },
      data: {
        status: BackgroundCheckStatus.failed,
        stripeRefundId: refundId,
        lastSyncedAt: new Date(),
      },
    })
    .catch((updateError: unknown) => {
      logger.error(
        'Background check compensation failed to mark the row failed; manual review required.',
        {
          organizationId,
          memberId,
          backgroundCheckRequestId: createdId,
          stripeRefundId: refundId,
          step,
          error:
            updateError instanceof Error
              ? updateError.message
              : String(updateError),
        },
      );
      return null;
    });
  if (marked && marked.count === 0) {
    // Lost the race after refunding, or the row already terminalized: the
    // refund went back but the row belongs to a live attempt or a finished
    // check. Ops must verify the money.
    logger.error(
      'Background check compensation lost a concurrent write; manual review required.',
      {
        organizationId,
        memberId,
        backgroundCheckRequestId: createdId,
        stripeRefundId: refundId,
        step,
      },
    );
  }
}

/**
 * Step 5: persist the Checkr result on this attempt's slot. The write is
 * guarded on the null pointer (a concurrent retry swap wins) and on
 * non-terminal status (a mid-flight terminalization freezes instead of
 * regressing). A lost race re-reads: a swapped pointer returns the live
 * attempt, a terminal row freezes, a deleted row throws NotFound so the
 * caller refunds the stranded charge.
 */
export async function persistCheckrResult({
  createdId,
  organizationId,
  memberId,
  identityResult,
  paymentService,
  paymentIntentId,
}: {
  createdId: string;
  organizationId: string;
  memberId: string;
  identityResult: IdentityResult;
  paymentService: BackgroundCheckPaymentService;
  paymentIntentId: string | null;
}): Promise<Awaited<ReturnType<typeof db.backgroundCheckRequest.findUnique>>> {
  const persisted = await db.backgroundCheckRequest.updateMany({
    // Keyed by record id plus the null pointer so a concurrent retry swap
    // wins. Terminal rows are excluded: a webhook may terminalize the row
    // while the Checkr create call is in flight, and this stale attempt must
    // not overwrite the finished state. A non-terminal advance (e.g.
    // invited -> in_progress) still matches, so the pointer write lands.
    where: {
      id: createdId,
      identityBackgroundCheckId: null,
      status: { notIn: terminalStatuses },
    },
    data: {
      identityBackgroundCheckId: identityResult.id,
      checkrCandidateId: identityResult.candidateId ?? null,
      checkrInvitationId: identityResult.invitationId ?? null,
      checkrPackage: process.env.CHECKR_PACKAGE ?? null,
      candidateUrl: identityResult.candidateUrl ?? null,
      status: identityResult.status,
      lastSyncedAt: new Date(),
    },
  });
  if (persisted.count > 0) {
    const written = await db.backgroundCheckRequest.findUnique({
      where: { id: createdId },
    });
    if (!written) {
      throw new NotFoundException('Background check not found.');
    }
    return written;
  }
  const fresh = await db.backgroundCheckRequest.findUnique({
    where: { id: createdId },
  });
  if (!fresh) {
    throw new NotFoundException('Background check not found.');
  }
  if (isTerminalBackgroundCheckStatus(fresh.status)) {
    // Mid-flight terminalization wins over this stale attempt. A terminal
    // failure still holds this attempt's unrefunded charge, so refund it and
    // persist the refund id — without the write the money moves but the row
    // never shows it and ops cannot reconcile. A terminal success already
    // delivered the check, so there is nothing to refund. A row that already
    // carries a refund id was compensated by another path: never refund
    // twice.
    if (
      (fresh.status === BackgroundCheckStatus.failed ||
        fresh.status === BackgroundCheckStatus.cancelled) &&
      !fresh.stripeRefundId
    ) {
      const refundId = await refundBestEffort({
        paymentService,
        organizationId,
        memberId,
        paymentIntentId,
        backgroundCheckRequestId: createdId,
        step: 'persist-ids',
      });
      if (refundId) {
        const recorded = await db.backgroundCheckRequest
          .updateMany({
            // Terminal-only predicate: a retry that swapped in a live
            // attempt between the re-read and this write must win. Status
            // is never touched here, only the refund marker.
            where: {
              id: createdId,
              status: {
                in: [
                  BackgroundCheckStatus.failed,
                  BackgroundCheckStatus.cancelled,
                ],
              },
            },
            data: {
              stripeRefundId: refundId,
              lastSyncedAt: new Date(),
            },
          })
          .catch((updateError: unknown) => {
            logger.error(
              'Background check refund marker write failed; manual reconciliation required.',
              {
                organizationId,
                memberId,
                backgroundCheckRequestId: createdId,
                stripeRefundId: refundId,
                step: 'persist-ids',
                error:
                  updateError instanceof Error
                    ? updateError.message
                    : String(updateError),
              },
            );
            return null;
          });
        if (recorded && recorded.count > 0) {
          const stamped = await db.backgroundCheckRequest.findUnique({
            where: { id: createdId },
          });
          if (stamped) return stamped;
        } else if (recorded) {
          logger.warn(
            'Background check refund marker lost a concurrent write; manual reconciliation required.',
            {
              organizationId,
              memberId,
              backgroundCheckRequestId: createdId,
              stripeRefundId: refundId,
            },
          );
        }
      }
    }
    return fresh;
  }
  // A concurrent retry swapped in a fresh vendor check while the Checkr
  // create call was in flight. That attempt is live — return it instead of
  // overwriting its pointer with this stale attempt.
  logger.warn(
    'Background check persist lost a concurrent retry swap; returning the fresh row.',
    {
      organizationId,
      memberId,
      backgroundCheckRequestId: createdId,
      identityBackgroundCheckId: identityResult.id,
    },
  );
  return fresh;
}
