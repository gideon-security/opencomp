import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BackgroundCheckStatus, db, Prisma } from '@db';
import type { BackgroundCheckIdentityClient } from './background-check-identity.client';

type GetForMemberFn = (params: {
  organizationId: string;
  memberId: string;
}) => Promise<{
  id: string;
  rerunCount: number;
  employeeName: string;
  employeeEmail: string;
  status: BackgroundCheckStatus;
  identityBackgroundCheckId: string | null;
} | null>;

function assertTransitionAllowed(
  action: 'cancel' | 'retry',
  status: BackgroundCheckStatus,
): void {
  const allowed: Record<'cancel' | 'retry', BackgroundCheckStatus[]> = {
    cancel: [
      BackgroundCheckStatus.invited,
      BackgroundCheckStatus.in_progress,
      BackgroundCheckStatus.in_review,
    ],
    retry: [BackgroundCheckStatus.failed, BackgroundCheckStatus.cancelled],
  };
  if (!allowed[action].includes(status)) {
    throw new BadRequestException(
      `Cannot ${action} a background check in '${status}' status.`,
    );
  }
}

export async function cancelForMember({
  organizationId,
  memberId,
  getForMember,
}: {
  organizationId: string;
  memberId: string;
  getForMember: GetForMemberFn;
}) {
  const existing = await getForMember({ organizationId, memberId });
  if (!existing) {
    throw new NotFoundException('Background check not found.');
  }
  assertTransitionAllowed('cancel', existing.status);

  // Guard the write with the status predicate: a completion that lands
  // between the read and the write must win over the cancel, never lose
  // a terminal state to it.
  const cancelled = await db.backgroundCheckRequest.updateMany({
    where: {
      organizationId,
      memberId,
      status: {
        in: [
          BackgroundCheckStatus.invited,
          BackgroundCheckStatus.in_progress,
          BackgroundCheckStatus.in_review,
        ],
      },
    },
    data: {
      status: BackgroundCheckStatus.cancelled,
      lastSyncedAt: new Date(),
    },
  });
  if (cancelled.count === 0) {
    const current = await getForMember({ organizationId, memberId });
    throw new BadRequestException(
      `Cannot cancel a background check in '${current?.status ?? 'unknown'}' status.`,
    );
  }
  const updated = await getForMember({ organizationId, memberId });
  if (!updated) {
    throw new NotFoundException('Background check not found.');
  }
  return updated;
}

export async function deleteForMember({
  organizationId,
  memberId,
  getForMember,
}: {
  organizationId: string;
  memberId: string;
  getForMember: GetForMemberFn;
}): Promise<{ ok: true }> {
  const existing = await getForMember({ organizationId, memberId });
  if (!existing) {
    throw new NotFoundException('Background check not found.');
  }
  // Hard delete; webhookEvents cascade via the FK. Frees the
  // @@unique([organizationId, memberId]) constraint for a fresh request.
  await db.backgroundCheckRequest.delete({
    where: { organizationId_memberId: { organizationId, memberId } },
  });
  return { ok: true };
}

export async function retryForMember({
  organizationId,
  memberId,
  requesterEmail,
  identityClient,
  getForMember,
}: {
  organizationId: string;
  memberId: string;
  requesterEmail: string;
  identityClient: BackgroundCheckIdentityClient;
  getForMember: GetForMemberFn;
}) {
  const existing = await getForMember({ organizationId, memberId });
  if (!existing) {
    throw new NotFoundException('Background check not found.');
  }
  // An `invited` row with no vendor pointer is an orphaned claim: the
  // process died (or Step 5 failed) between the slot claim and the Checkr
  // call. Normal `invited` rows always carry a pointer, so only orphans
  // may retry from here — otherwise the row could never advance again.
  if (existing.status === BackgroundCheckStatus.invited) {
    if (existing.identityBackgroundCheckId) {
      throw new BadRequestException(
        `Cannot retry a background check in 'invited' status.`,
      );
    }
  } else {
    assertTransitionAllowed('retry', existing.status);
  }

  const attempt = existing.rerunCount + 1;

  // Free retry: no charge. Create a fresh Identity check first (varied
  // idempotency key) so a late webhook from the prior check cannot match
  // the row after we swap in the new id.
  let identityResult;
  try {
    identityResult = await identityClient.createBackgroundCheck({
      organizationId,
      memberId,
      employeeName: existing.employeeName,
      employeeEmail: existing.employeeEmail,
      requesterEmail,
      // Per-record, per-attempt key so each retry creates a fresh vendor
      // check rather than colliding with a prior attempt's idempotency key.
      idempotencyKey: `comp-background-check:${existing.id}:${attempt}`,
    });
  } catch (error) {
    // Restore the prior status (retry is only allowed from 'failed' or
    // 'cancelled'). Forcing 'failed' here would strip a cancelled check of the
    // webhook terminal-guard and let a late vendor webhook resurrect it.
    // Guard on the vendor pointer: a concurrent retry may have swapped in a
    // fresh check while this attempt was in flight, and the restore must not
    // drag the new pointer back to the old status.
    await db.backgroundCheckRequest.updateMany({
      where: {
        organizationId,
        memberId,
        identityBackgroundCheckId: existing.identityBackgroundCheckId,
      },
      data: { status: existing.status, lastSyncedAt: new Date() },
    });
    throw error;
  }

  // Guard on the status read above: a concurrent retry that already moved
  // the row must win, and this attempt must not overwrite its fresh check.
  const swapped = await db.backgroundCheckRequest.updateMany({
    where: {
      organizationId,
      memberId,
      status: existing.status,
      identityBackgroundCheckId: existing.identityBackgroundCheckId,
    },
    data: {
      identityBackgroundCheckId: identityResult.id,
      checkrCandidateId: identityResult.candidateId ?? null,
      checkrInvitationId: identityResult.invitationId ?? null,
      checkrPackage: process.env.CHECKR_PACKAGE ?? null,
      candidateUrl: identityResult.candidateUrl ?? null,
      status: identityResult.status,
      rerunCount: attempt,
      identityStatus: null,
      employmentStatus: null,
      referenceStatus: null,
      rightToWorkStatus: null,
      adjudicationStatus: null,
      reportSnapshot: Prisma.JsonNull,
      reportSyncedAt: null,
      lastSyncedAt: new Date(),
    },
  });
  if (swapped.count === 0) {
    throw new BadRequestException(
      'Background check changed while retrying. Fetch the latest state and try again.',
    );
  }
  const updated = await getForMember({ organizationId, memberId });
  if (!updated) {
    throw new NotFoundException('Background check not found.');
  }
  return updated;
}
