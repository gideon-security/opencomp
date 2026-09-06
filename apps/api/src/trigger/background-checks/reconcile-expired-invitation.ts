import { BackgroundCheckStatus, db } from '@db';
import { logger } from '@gideon-defender/trigger-local';
import { terminalStatusFromInvitation } from '../../background-checks/background-check-invitation';
import type { CheckrClient } from '../../background-checks/checkr.client';

export type MissingReportOutcome = 'terminalized' | 'backed-off';

/**
 * Handle a reconcile row whose report is missing in Checkr. An expired or
 * deleted invitation can never produce a report, so a still-invited row
 * advances to its terminal state — mirroring the manual-sync escape —
 * instead of backing off on it every hour forever. Anything else only
 * advances lastSyncedAt so the row is not re-polled every hour.
 */
export async function handleMissingReport({
  check,
  checkrClient,
  nonTerminalStatuses,
}: {
  check: {
    id: string;
    status: BackgroundCheckStatus;
    checkrInvitationId: string | null;
  };
  checkrClient: CheckrClient;
  nonTerminalStatuses: BackgroundCheckStatus[];
}): Promise<MissingReportOutcome> {
  let terminalFromInvitation: BackgroundCheckStatus | null = null;
  if (
    check.status === BackgroundCheckStatus.invited &&
    check.checkrInvitationId
  ) {
    try {
      terminalFromInvitation = await terminalStatusFromInvitation({
        client: checkrClient,
        invitationId: check.checkrInvitationId,
      });
    } catch (error) {
      // Invitation unreadable (vendor blip): back off below like a
      // missing report instead of failing the whole batch.
      logger.warn(
        'Checkr invitation lookup failed during reconcile; backing off',
        {
          backgroundCheckRequestId: check.id,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }
  await db.backgroundCheckRequest.updateMany({
    where: { id: check.id, status: { in: nonTerminalStatuses } },
    data: {
      ...(terminalFromInvitation ? { status: terminalFromInvitation } : {}),
      lastSyncedAt: new Date(),
    },
  });
  if (terminalFromInvitation) {
    logger.info('Reconciled expired invitation to terminal status', {
      backgroundCheckRequestId: check.id,
      to: terminalFromInvitation,
      provider: 'checkr',
    });
    return 'terminalized';
  }
  return 'backed-off';
}
