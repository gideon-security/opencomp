import { BackgroundCheckStatus } from '@db';
import { mapCheckrReportToStatus } from './background-checks.types';

/**
 * Map a Checkr invitation to the terminal status of a still-invited row.
 * An expired or deleted invitation can never produce a report, so the
 * check failed (expired) or was cancelled (deleted) and may be retried.
 * Returns null when the invitation is still live, unreadable, or absent:
 * callers back off instead of terminalizing on uncertainty. Auth and
 * config errors propagate — a bad key never heals by waiting.
 */
export async function terminalStatusFromInvitation({
  client,
  invitationId,
}: {
  client: {
    getInvitation: (invitationId: string) => Promise<unknown>;
  };
  invitationId: string;
}): Promise<BackgroundCheckStatus | null> {
  const invitation = await client.getInvitation(invitationId);
  const mapped = mapCheckrReportToStatus(invitation);
  if (mapped === 'failed' || mapped === 'cancelled') {
    return mapped;
  }
  return null;
}
