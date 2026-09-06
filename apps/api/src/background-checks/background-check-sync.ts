import {
  BadRequestException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { BackgroundCheckStatus, db, Prisma } from '@db';
import type { CheckrClient } from './checkr.client';
import { fetchCompletedReportSnapshot } from './background-check-report-snapshot';
import { terminalStatusFromInvitation } from './background-check-invitation';
import { backoffSync, writeSyncUpdate } from './background-check-sync-write';
import {
  backgroundCheckStatuses,
  isTerminalBackgroundCheckStatus,
  mapCheckrReportToStatus,
} from './background-checks.types';

/**
 * Manual escape hatch for a missed webhook: fetch the latest Checkr report
 * and persist it. Terminal rows are frozen — a manual sync must never
 * regress or resurrect a finished check.
 */

const logger = new Logger('BackgroundCheckSync');
export async function syncBackgroundCheck({
  organizationId,
  memberId,
  identityClient,
}: {
  organizationId: string;
  memberId: string;
  identityClient: CheckrClient;
}): Promise<{ record: unknown; identity?: unknown; syncedAt: string }> {
  const record = await db.backgroundCheckRequest.findUnique({
    where: { organizationId_memberId: { organizationId, memberId } },
  });
  if (!record?.identityBackgroundCheckId) {
    throw new NotFoundException('No background check to sync.');
  }

  if (isTerminalBackgroundCheckStatus(record.status)) {
    // Status stays frozen, but a terminal row that committed without a
    // report snapshot still heals here — manual sync is the only backfill
    // path for the warn-and-commit case in fetchCompletedReportSnapshot.
    if (!record.reportSnapshot) {
      let missingSnapshot: Prisma.InputJsonValue | null = null;
      try {
        missingSnapshot = await fetchCompletedReportSnapshot({
          identityClient,
          identityBackgroundCheckId: record.identityBackgroundCheckId,
          invitationId: record.checkrInvitationId ?? null,
          eventType: 'sync',
          status: record.status,
        });
      } catch (error) {
        // Snapshot still unavailable: leave the frozen row alone and back
        // off via the touch below instead of failing manual sync.
        if (!(error instanceof ServiceUnavailableException)) throw error;
        logger.warn('Checkr snapshot backfill failed; leaving row frozen', {
          organizationId,
          memberId,
        });
      }
      if (missingSnapshot) {
        // Guard the backfill with the status-plus-pointer predicate: a
        // retry that swaps in a new attempt between the read above and
        // this write must win, or the old check's snapshot lands on the
        // new vendor check. A lost race returns the fresh row unwritten.
        const backfilled = await db.backgroundCheckRequest.updateMany({
          where: {
            organizationId,
            memberId,
            status: record.status,
            identityBackgroundCheckId: record.identityBackgroundCheckId,
          },
          data: {
            reportSnapshot: missingSnapshot,
            reportSyncedAt: new Date(),
            lastSyncedAt: new Date(),
          },
        });
        if (backfilled.count === 0) {
          logger.warn(
            'Checkr snapshot backfill lost a concurrent update; returning fresh row',
            { organizationId, memberId },
          );
        }
        const updated = await db.backgroundCheckRequest.findUnique({
          where: { organizationId_memberId: { organizationId, memberId } },
        });
        if (!updated) {
          throw new NotFoundException('Background check not found.');
        }
        return { record: updated, syncedAt: new Date().toISOString() };
      }
    }
    // Frozen rows report the touch, not a fresh read: the status stays as
    // committed and only lastSyncedAt advances, so callers can tell the
    // row was seen but not re-polled. Return the updated row so the
    // caller's lastSyncedAt matches what was written.
    const touched = await db.backgroundCheckRequest.update({
      where: { organizationId_memberId: { organizationId, memberId } },
      data: { lastSyncedAt: new Date() },
    });
    return { record: touched, syncedAt: new Date().toISOString() };
  }

  // Prefer resolveReport (report fetch plus invitation recovery) when the
  // client supports it; plain test doubles only expose getReport.
  // A Checkr outage is not fatal: back off like a missing report instead
  // of failing manual sync while the vendor is down.
  const canResolve = typeof identityClient.resolveReport === 'function';
  let resolved: { report: unknown; reportId: string };
  try {
    resolved = canResolve
      ? await identityClient.resolveReport({
          reportId: record.identityBackgroundCheckId,
          invitationId: record.checkrInvitationId ?? null,
        })
      : {
          report: await identityClient.getReport(
            record.identityBackgroundCheckId,
          ),
          reportId: record.identityBackgroundCheckId,
        };
  } catch (error) {
    // Auth failures must surface to the operator, not dissolve into a
    // backoff: a bad key never heals by waiting. A missing key is the same
    // class of misconfiguration (apiKey() throws BadRequest): succeeding
    // with `identity: null` would hide it behind a touched timestamp.
    if (error instanceof UnauthorizedException) throw error;
    if (error instanceof BadRequestException) throw error;
    // A Checkr outage is not fatal: back off like a missing report instead
    // of failing manual sync while the vendor is down. Log loudly anyway —
    // programming errors surface here too and must not fail
    // silently into the backoff.
    logger.warn('Checkr resolve failed during manual sync; backing off', {
      organizationId,
      memberId,
      error: error instanceof Error ? error.message : String(error),
    });
    resolved = { report: null, reportId: record.identityBackgroundCheckId };
  }
  const identity = resolved.report;

  // Graduate a stale invitation-id pointer once the report exists, so the
  // next sync, webhook, and reconcile all hit the report directly.
  const pointerUpdate =
    resolved.reportId !== record.identityBackgroundCheckId
      ? { identityBackgroundCheckId: resolved.reportId }
      : {};

  // No report yet (invited rows store the invitation id as a placeholder
  // until the candidate completes the flow) or the report is gone from
  // Checkr. An expired or deleted invitation can never produce a report, so
  // a still-invited row advances to its terminal state here instead of
  // deadlocked backoff. Otherwise back off like reconcile does: touch the
  // timestamp so this row is not re-polled immediately, and leave status
  // alone.
  if (!identity) {
    let terminalFromInvitation: BackgroundCheckStatus | null = null;
    if (record.status === 'invited' && record.checkrInvitationId) {
      try {
        terminalFromInvitation = await terminalStatusFromInvitation({
          client: identityClient,
          invitationId: record.checkrInvitationId,
        });
      } catch (error) {
        if (error instanceof UnauthorizedException) throw error;
        if (error instanceof BadRequestException) throw error;
        logger.warn('Checkr invitation lookup failed during manual sync', {
          organizationId,
          memberId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    const updated = await writeSyncUpdate({
      organizationId,
      memberId,
      expectedIdentityBackgroundCheckId: record.identityBackgroundCheckId,
      data: {
        ...pointerUpdate,
        ...(terminalFromInvitation ? { status: terminalFromInvitation } : {}),
        lastSyncedAt: new Date(),
      },
    });
    return { record: updated, identity, syncedAt: new Date().toISOString() };
  }

  const mappedStatus = mapCheckrReportToStatus(identity);
  if (!(backgroundCheckStatuses as readonly string[]).includes(mappedStatus)) {
    // Unknown vendor status. Do not throw: the row would 400 on every sync
    // and reconcile would re-fetch it every hour. Back off instead.
    const updated = await backoffSync({
      organizationId,
      memberId,
      expectedIdentityBackgroundCheckId: record.identityBackgroundCheckId,
      pointerUpdate,
    });
    return { record: updated, identity, syncedAt: new Date().toISOString() };
  }

  let reportSnapshot: Prisma.InputJsonValue | null;
  try {
    reportSnapshot = await fetchCompletedReportSnapshot({
      identityClient,
      identityBackgroundCheckId: resolved.reportId,
      eventType: 'sync',
      status: mappedStatus as BackgroundCheckStatus,
    });
  } catch (error) {
    // The snapshot is unavailable (vendor blip). Back off without writing
    // the terminal status: committing it now would leave a terminal row
    // with no snapshot that only manual sync could backfill.
    if (error instanceof ServiceUnavailableException) {
      logger.warn(
        'Checkr snapshot unavailable during manual sync; backing off',
        {
          organizationId,
          memberId,
        },
      );
      const updated = await backoffSync({
        organizationId,
        memberId,
        expectedIdentityBackgroundCheckId: record.identityBackgroundCheckId,
        pointerUpdate,
      });
      return { record: updated, identity, syncedAt: new Date().toISOString() };
    }
    throw error;
  }

  const updated = await writeSyncUpdate({
    organizationId,
    memberId,
    expectedIdentityBackgroundCheckId: record.identityBackgroundCheckId,
    data: {
      ...pointerUpdate,
      status: mappedStatus as BackgroundCheckStatus,
      lastSyncedAt: new Date(),
      ...(reportSnapshot ? { reportSnapshot, reportSyncedAt: new Date() } : {}),
    },
  });
  return { record: updated, identity, syncedAt: new Date().toISOString() };
}
