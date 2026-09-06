import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BackgroundCheckStatus, db, Prisma } from '@db';
import {
  isTerminalBackgroundCheckStatus,
  terminalBackgroundCheckStatuses,
} from './background-checks.types';

const terminalStatuses = [
  ...terminalBackgroundCheckStatuses,
] as BackgroundCheckStatus[];

/**
 * Predicate-guarded sync write. The status-plus-pointer predicate runs
 * inside the write itself, so a concurrent retry, webhook, or reconcile run
 * that swaps the vendor pointer or terminalizes the row between the vendor
 * read and this write wins — a plain read-then-update would clobber the
 * fresh attempt with a stale report id and mapped status. A lost race
 * freezes instead: only lastSyncedAt advances on terminal rows, and a
 * changed non-terminal row throws so the operator retries on fresh state.
 */
export async function writeSyncUpdate({
  organizationId,
  memberId,
  expectedIdentityBackgroundCheckId,
  data,
}: {
  organizationId: string;
  memberId: string;
  expectedIdentityBackgroundCheckId: string | null;
  data: Prisma.BackgroundCheckRequestUpdateManyMutationInput;
}) {
  const swapped = await db.backgroundCheckRequest.updateMany({
    where: {
      organizationId,
      memberId,
      status: { notIn: terminalStatuses },
      identityBackgroundCheckId: expectedIdentityBackgroundCheckId,
    },
    data,
  });
  if (swapped.count > 0) {
    const updated = await db.backgroundCheckRequest.findUnique({
      where: { organizationId_memberId: { organizationId, memberId } },
    });
    if (!updated) {
      throw new NotFoundException('Background check not found.');
    }
    return updated;
  }
  const fresh = await db.backgroundCheckRequest.findUnique({
    where: { organizationId_memberId: { organizationId, memberId } },
  });
  if (!fresh) {
    throw new NotFoundException('Background check not found.');
  }
  if (isTerminalBackgroundCheckStatus(fresh.status)) {
    return db.backgroundCheckRequest.update({
      where: { organizationId_memberId: { organizationId, memberId } },
      data: { lastSyncedAt: new Date() },
    });
  }
  throw new BadRequestException(
    'Background check changed while syncing. Fetch the latest state and try again.',
  );
}

/** Back off without writing status: touch the timestamp so the row is not
 * re-polled immediately, and leave the status for the next attempt. */
export async function backoffSync({
  organizationId,
  memberId,
  expectedIdentityBackgroundCheckId,
  pointerUpdate,
}: {
  organizationId: string;
  memberId: string;
  expectedIdentityBackgroundCheckId: string | null;
  pointerUpdate: Prisma.BackgroundCheckRequestUpdateManyMutationInput;
}) {
  const updated = await writeSyncUpdate({
    organizationId,
    memberId,
    expectedIdentityBackgroundCheckId,
    data: { ...pointerUpdate, lastSyncedAt: new Date() },
  });
  return updated;
}
