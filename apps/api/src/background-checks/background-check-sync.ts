import { NotFoundException } from '@nestjs/common';
import { BackgroundCheckStatus, db } from '@db';
import type { BackgroundCheckIdentityClient } from './background-check-identity.client';
import { fetchCompletedReportSnapshot } from './background-check-report-snapshot';
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
export async function syncBackgroundCheck({
  organizationId,
  memberId,
  identityClient,
}: {
  organizationId: string;
  memberId: string;
  identityClient: BackgroundCheckIdentityClient;
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
      const missingSnapshot = await fetchCompletedReportSnapshot({
        identityClient,
        identityBackgroundCheckId: record.identityBackgroundCheckId,
        eventType: 'sync',
        status: record.status,
      });
      if (missingSnapshot) {
        const updated = await db.backgroundCheckRequest.update({
          where: { organizationId_memberId: { organizationId, memberId } },
          data: {
            reportSnapshot: missingSnapshot,
            reportSyncedAt: new Date(),
            lastSyncedAt: new Date(),
          },
        });
        return { record: updated, syncedAt: new Date().toISOString() };
      }
    }
    return { record, syncedAt: new Date().toISOString() };
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
  } catch {
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
  // Checkr. Back off like reconcile does: touch the timestamp so this row
  // is not re-polled immediately, and leave status alone.
  if (!identity) {
    const updated = await db.backgroundCheckRequest.update({
      where: { organizationId_memberId: { organizationId, memberId } },
      data: { ...pointerUpdate, lastSyncedAt: new Date() },
    });
    return { record: updated, identity, syncedAt: new Date().toISOString() };
  }

  const mappedStatus = mapCheckrReportToStatus(identity);
  if (!(backgroundCheckStatuses as readonly string[]).includes(mappedStatus)) {
    // Unknown vendor status. Do not throw: the row would 400 on every sync
    // and reconcile would re-fetch it every hour. Back off instead.
    const updated = await db.backgroundCheckRequest.update({
      where: { organizationId_memberId: { organizationId, memberId } },
      data: { ...pointerUpdate, lastSyncedAt: new Date() },
    });
    return { record: updated, identity, syncedAt: new Date().toISOString() };
  }

  const reportSnapshot = await fetchCompletedReportSnapshot({
    identityClient,
    identityBackgroundCheckId: resolved.reportId,
    eventType: 'sync',
    status: mappedStatus as BackgroundCheckStatus,
  });

  const updated = await db.backgroundCheckRequest.update({
    where: { organizationId_memberId: { organizationId, memberId } },
    data: {
      ...pointerUpdate,
      status: mappedStatus as BackgroundCheckStatus,
      lastSyncedAt: new Date(),
      ...(reportSnapshot ? { reportSnapshot, reportSyncedAt: new Date() } : {}),
    },
  });
  return { record: updated, identity, syncedAt: new Date().toISOString() };
}
