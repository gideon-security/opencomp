import { Logger, NotFoundException } from '@nestjs/common';
import { BackgroundCheckStatus, db } from '@db';
import type { CheckrClient } from './checkr.client';
import type { BackgroundCheckPaymentService } from './background-check-payment.service';
import {
  chargeOrRollbackClaim,
  reclaimStalePaymentlessClaim,
  refundBestEffort,
} from './background-check-compensation';
import { isUniqueConstraintError } from './background-check-webhook-dedup';
import {
  markRequestFailed,
  persistCheckrResult,
} from './background-check-request-persist';

const logger = new Logger('BackgroundCheckRequest');

type BackgroundCheckRequestRow = Awaited<
  ReturnType<typeof db.backgroundCheckRequest.findUnique>
>;

type GetForMemberFn = (params: {
  organizationId: string;
  memberId: string;
}) => Promise<BackgroundCheckRequestRow>;

/**
 * Five-step request orchestration: claim the slot, charge, persist the
 * payment, create the Checkr check, persist the result. Each step
 * compensates (refund, mark failed) so a mid-flow failure never leaves a
 * paid, pointer-less orphan silently. Separated from
 * background-checks.service.ts to keep both files under the 300-line limit.
 */
export async function requestBackgroundCheckForMember({
  organizationId,
  memberId,
  employeeName,
  employeeEmail,
  requesterNotes,
  identityClient,
  paymentService,
  getForMember,
}: {
  organizationId: string;
  memberId: string;
  employeeName: string;
  employeeEmail: string;
  requesterNotes?: string;
  identityClient: CheckrClient;
  paymentService: BackgroundCheckPaymentService;
  getForMember: GetForMemberFn;
}) {
  const existing = await getForMember({ organizationId, memberId });
  if (existing) {
    // A stale payment-less claim is a crashed Step 2: reclaim it so the
    // org+member key never wedges on a rollback delete that failed.
    const reclaimed = await reclaimStalePaymentlessClaim({
      organizationId,
      memberId,
      existing,
    });
    if (!reclaimed) return existing;
  }

  // Fail fast before the slot claim and the charge. A missing Checkr
  // package/key or a name Checkr would reject must 400 here — not after
  // Stripe and Checkr objects already exist.
  identityClient.assertConfigured();
  identityClient.assertCreatableInput({ employeeName, employeeEmail });

  const member = await db.member.findFirst({
    where: { id: memberId, organizationId, deactivated: false },
    select: { id: true, organizationId: true },
  });

  if (!member) {
    throw new NotFoundException('Member not found.');
  }

  // Step 1: Claim the record slot before charging. Catches the TOCTOU race
  // where two concurrent requests both pass the getForMember check.
  let created: Awaited<ReturnType<typeof db.backgroundCheckRequest.create>>;
  try {
    created = await db.backgroundCheckRequest.create({
      data: {
        organizationId,
        memberId,
        employeeName,
        employeeEmail,
        requesterNotes,
        status: BackgroundCheckStatus.invited,
        lastSyncedAt: new Date(),
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const raced = await getForMember({ organizationId, memberId });
      if (raced) {
        // A stale wedge heals on the spot: reclaim it and run the flow
        // again instead of returning a row that can never advance.
        const reclaimed = await reclaimStalePaymentlessClaim({
          organizationId,
          memberId,
          existing: raced,
        });
        if (reclaimed) {
          return requestBackgroundCheckForMember({
            organizationId,
            memberId,
            employeeName,
            employeeEmail,
            requesterNotes,
            identityClient,
            paymentService,
            getForMember,
          });
        }
        return raced;
      }
    }
    throw error;
  }

  // Step 2: Charge — record exists so a failure here is recoverable.
  // Roll the slot claim back on charge failure: a lingering payment-less
  // row would qualify for the free orphan retry without ever being charged.
  const payment = await chargeOrRollbackClaim({
    paymentService,
    organizationId,
    memberId,
    createdId: created.id,
  });

  // Step 3: Persist payment info. Refund if this write fails. Keyed by
  // record id: a delete + re-request frees the org+member key mid-flight.
  try {
    await db.backgroundCheckRequest.update({
      where: { id: created.id },
      data: {
        stripePaymentIntentId: payment.paymentIntentId,
        stripePaymentStatus: payment.status,
        stripeAmountCents: payment.amount,
        stripeCurrency: payment.currency,
        lastSyncedAt: new Date(),
      },
    });
  } catch (error) {
    // Best-effort: the refund must not mask the original persistence
    // error, and the row is removed below so the free orphan retry cannot
    // heal a refunded row.
    await refundBestEffort({
      paymentService,
      organizationId,
      memberId,
      paymentIntentId: payment.paymentIntentId,
      backgroundCheckRequestId: created.id,
      step: 'persist-payment',
    });
    await db.backgroundCheckRequest
      .delete({ where: { id: created.id } })
      .catch((deleteError: unknown) => {
        logger.error(
          'Background check payment persist failed and the row cleanup failed; manual review required.',
          {
            organizationId,
            memberId,
            backgroundCheckRequestId: created.id,
            paymentIntentId: payment.paymentIntentId,
            error:
              deleteError instanceof Error
                ? deleteError.message
                : String(deleteError),
          },
        );
        return null;
      });
    throw error;
  }

  // Step 4: Call Checkr — refund on failure. Key on the record's unique
  // id (not memberId) so a delete + re-request creates a genuinely fresh
  // vendor check instead of colliding with the original idempotency key.
  let identityResult;
  try {
    identityResult = await identityClient.createBackgroundCheck({
      organizationId,
      memberId,
      employeeName,
      employeeEmail,
      idempotencyKey: `comp-background-check:${created.id}`,
    });
  } catch (error) {
    // Best-effort cleanup like Step 5: the refund and the failed-mark must
    // never mask the original Checkr error, and the row must still land in
    // `failed` instead of staying a paid, pointer-less `invited` orphan.
    // The mark itself is terminal-guarded: a concurrent terminalization or
    // retry swap wins over this attempt.
    const refundId = await refundBestEffort({
      paymentService,
      organizationId,
      memberId,
      paymentIntentId: payment.paymentIntentId,
      backgroundCheckRequestId: created.id,
      step: 'checkr-create',
    });
    await markRequestFailed({
      createdId: created.id,
      organizationId,
      memberId,
      refundId,
      step: 'checkr-create',
    });
    throw error;
  }

  // Step 5: Persist the Checkr result on this attempt's slot. A concurrent
  // retry swap or mid-flight terminalization wins over this stale attempt
  // (see persistCheckrResult). Only a genuine write failure compensates
  // here; a deleted row refunds the stranded charge without a ghost mark.
  try {
    return await persistCheckrResult({
      createdId: created.id,
      organizationId,
      memberId,
      identityResult,
      paymentService,
      paymentIntentId: payment.paymentIntentId,
    });
  } catch (error) {
    if (error instanceof NotFoundException) {
      await refundBestEffort({
        paymentService,
        organizationId,
        memberId,
        paymentIntentId: payment.paymentIntentId,
        backgroundCheckRequestId: created.id,
        step: 'persist-ids',
      });
      throw error;
    }
    const refundId = await refundBestEffort({
      paymentService,
      organizationId,
      memberId,
      paymentIntentId: payment.paymentIntentId,
      backgroundCheckRequestId: created.id,
      step: 'persist-ids',
    });
    await markRequestFailed({
      createdId: created.id,
      organizationId,
      memberId,
      refundId,
      step: 'persist-ids',
    });
    throw error;
  }
}
