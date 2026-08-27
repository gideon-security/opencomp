import { BadRequestException } from '@nestjs/common';
import { db } from '@db';
import { isMemberOrgParticipant } from './org-participation';

/**
 * Validates that the given member can be assigned as assignee/approver in the organization.
 * Throws BadRequestException if member not found or is a platform admin in a non-internal org.
 * No-op if assigneeId is null/undefined (unassignment).
 */
export async function validateAssigneeNotPlatformAdmin(
  assigneeId: string | null | undefined,
  organizationId: string,
  roleLabel: 'assignee' | 'approver' = 'assignee',
): Promise<void> {
  if (!assigneeId) return;

  const member = await db.member.findFirst({
    where: { id: assigneeId, organizationId },
    include: { user: { select: { role: true } } },
  });

  if (!member) {
    const msg =
      roleLabel === 'approver'
        ? 'Approver is not a member of this organization'
        : 'Assignee is not a member of this organization';
    throw new BadRequestException(msg);
  }

  if (!(await isMemberOrgParticipant(member.user.role, organizationId))) {
    throw new BadRequestException(`Cannot assign a platform admin as ${roleLabel}`);
  }
}

/**
 * Validates approver specifically (requires deactivated check as well, for submitForReview flows).
 * Returns the approver member for callers that need it (e.g. audit log).
 */
export async function validateApproverNotPlatformAdmin(
  approverId: string,
  organizationId: string,
) {
  const approver = await db.member.findFirst({
    where: { id: approverId, organizationId, deactivated: false },
    include: { user: true },
  });

  if (!approver) {
    throw new BadRequestException('Approver not found or is deactivated');
  }

  if (!(await isMemberOrgParticipant(approver.user.role, organizationId))) {
    throw new BadRequestException('Cannot assign a platform admin as approver');
  }

  return approver;
}
