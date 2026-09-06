import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { BackgroundCheckStatus, db } from '@db';
import type { BackgroundCheckPaymentService } from './background-check-payment.service';
import { STALE_INFLIGHT_MS } from './background-check-webhook-claim';

const logger = new Logger('BackgroundCheckCompensation');

type ChargeResult = Awaited<
  ReturnType<BackgroundCheckPaymentService['charge']>
>;

/**
 * Charge for the claimed slot. On charge failure the slot claim rolls
 * back: a lingering payment-less row would qualify for the free orphan
 * retry without ever being charged. A failed rollback is logged and the
 * charge error rethrows — the next request reclaims the stale wedge.
 */
export async function chargeOrRollbackClaim({
  paymentService,
  organizationId,
  memberId,
  createdId,
}: {
  paymentService: BackgroundCheckPaymentService;
  organizationId: string;
  memberId: string;
  createdId: string;
}): Promise<ChargeResult> {
  try {
    return await paymentService.charge({ organizationId, memberId });
  } catch (chargeError) {
    await db.backgroundCheckRequest
      .delete({ where: { id: createdId } })
      .catch((deleteError: unknown) => {
        logger.error(
          'Background check charge failed and the slot-claim rollback failed; manual cleanup required.',
          {
            organizationId,
            memberId,
            backgroundCheckRequestId: createdId,
            error:
              deleteError instanceof Error
                ? deleteError.message
                : String(deleteError),
          },
        );
        return null;
      });
    throw chargeError;
  }
}

/**
 * Best-effort refund that never throws. The payment service already logs
 * its own failures, but only this caller knows the request row — so log
 * here too with the row id for manual reconciliation. Returns the Stripe
 * refund id, or null when no refund was needed or the refund failed.
 */
export async function refundBestEffort({
  paymentService,
  organizationId,
  memberId,
  paymentIntentId,
  backgroundCheckRequestId,
  step,
}: {
  paymentService: BackgroundCheckPaymentService;
  organizationId: string;
  memberId: string;
  paymentIntentId: string | null;
  backgroundCheckRequestId: string;
  step: 'persist-payment' | 'checkr-create' | 'persist-ids';
}): Promise<string | null> {
  try {
    const refundId = await paymentService.refund({
      organizationId,
      memberId,
      paymentIntentId,
    });
    if (!refundId && paymentIntentId) {
      logger.error(
        'Background check compensation refund failed; manual refund required.',
        {
          organizationId,
          memberId,
          paymentIntentId,
          backgroundCheckRequestId,
          step,
        },
      );
    }
    return refundId;
  } catch (error) {
    logger.error(
      'Background check compensation refund threw; manual refund required.',
      {
        organizationId,
        memberId,
        paymentIntentId,
        backgroundCheckRequestId,
        step,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    return null;
  }
}

type StaleClaimRow = {
  id: string;
  status: BackgroundCheckStatus;
  stripePaymentIntentId: string | null;
  identityBackgroundCheckId: string | null;
  lastSyncedAt: Date | null;
};

/**
 * Reclaim a stale payment-less claim so the org+member key never wedges
 * when a Step 2 rollback delete fails mid-flight. Only rows that are
 * `invited`, carry no payment and no vendor pointer, and have been idle
 * past the stale window qualify — an in-flight claim is never stolen.
 * Returns true when the row was deleted and the caller should claim again.
 */
export async function reclaimStalePaymentlessClaim({
  organizationId,
  memberId,
  existing,
}: {
  organizationId: string;
  memberId: string;
  existing: StaleClaimRow | null;
}): Promise<boolean> {
  if (!existing) return false;
  if (existing.status !== BackgroundCheckStatus.invited) return false;
  if (existing.stripePaymentIntentId) return false;
  if (existing.identityBackgroundCheckId) return false;
  if (!existing.lastSyncedAt) return false;
  if (Date.now() - existing.lastSyncedAt.getTime() <= STALE_INFLIGHT_MS) {
    return false;
  }
  try {
    // Predicate the delete on the full stale-claim shape, not the bare id:
    // Step 2/3 may persist the payment between the caller's read and this
    // delete. A bare `delete({ where: { id } })` would then destroy a paid
    // row. A lost race returns false so the caller treats the row as live.
    const staleCutoff = new Date(Date.now() - STALE_INFLIGHT_MS);
    const removed = await db.backgroundCheckRequest.deleteMany({
      where: {
        id: existing.id,
        status: BackgroundCheckStatus.invited,
        stripePaymentIntentId: null,
        identityBackgroundCheckId: null,
        lastSyncedAt: { lte: staleCutoff },
      },
    });
    if (removed.count === 0) {
      return false;
    }
  } catch (error) {
    logger.error(
      'Stale payment-less background check claim reclaim failed; manual cleanup may be required.',
      {
        organizationId,
        memberId,
        backgroundCheckRequestId: existing.id,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    throw new ServiceUnavailableException(
      'Background check request is temporarily unavailable. Try again.',
    );
  }
  logger.warn('Reclaimed stale payment-less background check claim', {
    organizationId,
    memberId,
    backgroundCheckRequestId: existing.id,
  });
  return true;
}
