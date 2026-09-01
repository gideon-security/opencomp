import { BackgroundCheckStatus, db, Prisma } from '@db';
import { logger, schedules } from '@gideon-defender/trigger-local';
import { z } from 'zod';
import { CheckrClient } from '../../background-checks/checkr.client';
import { fetchCompletedReportSnapshot } from '../../background-checks/background-check-report-snapshot';
import {
  backgroundCheckStatuses,
  mapCheckrReportToStatus,
} from '../../background-checks/background-checks.types';

const NON_TERMINAL_STATUSES: BackgroundCheckStatus[] = [
  BackgroundCheckStatus.invited,
  BackgroundCheckStatus.in_progress,
  BackgroundCheckStatus.in_review,
];

const STALE_AFTER_MS = 60 * 60 * 1000;

const SUB_STATUS_SCHEMA = z
  .object({
    identity: z.string(),
    employment: z.string(),
    references: z.string(),
    rightToWork: z.string(),
    adjudication: z.string(),
  })
  .partial();

interface ReconciliationResult {
  success: boolean;
  checked: number;
  updated: number;
  unparseable: number;
}

export function parseIdentityCheckState(raw: unknown): {
  status?: BackgroundCheckStatus;
  statuses?: z.infer<typeof SUB_STATUS_SCHEMA>;
} {
  const record = z.record(z.string(), z.unknown()).safeParse(raw);
  if (!record.success) return {};

  // Try direct status first (Checkr report has status at top level)
  // Then try Checkr mapping via raw status string
  const statusRaw = record.data.status as string | undefined;
  const status = z.enum(backgroundCheckStatuses).safeParse(statusRaw);
  if (status.success) {
    const statuses = SUB_STATUS_SCHEMA.safeParse(record.data.statuses);
    return {
      status: status.data,
      statuses: statuses.success ? statuses.data : undefined,
    };
  }

  // For Checkr reports, an unmapped raw status falls through to undefined
  // and the caller applies mapCheckrReportToStatus as a fallback.
  const statuses = SUB_STATUS_SCHEMA.safeParse(record.data.statuses);

  return {
    status: undefined,
    statuses: statuses.success ? statuses.data : undefined,
  };
}

export async function runReconciliation(): Promise<ReconciliationResult> {
  const hasKey = !!process.env.CHECKR_API_KEY;
  if (!hasKey) {
    logger.warn('CHECKR_API_KEY not configured — skipping reconciliation');
    return { success: true, checked: 0, updated: 0, unparseable: 0 };
  }

  const staleBefore = new Date(Date.now() - STALE_AFTER_MS);

  const stuckChecks = await db.backgroundCheckRequest.findMany({
    where: {
      status: { in: NON_TERMINAL_STATUSES },
      identityBackgroundCheckId: { not: null },
      OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: staleBefore } }],
    },
    select: {
      id: true,
      identityBackgroundCheckId: true,
      checkrInvitationId: true,
      status: true,
      identityStatus: true,
      employmentStatus: true,
      referenceStatus: true,
      rightToWorkStatus: true,
      adjudicationStatus: true,
    },
  });

  if (stuckChecks.length === 0) {
    logger.info('No stale in-flight background checks to reconcile');
    return { success: true, checked: 0, updated: 0, unparseable: 0 };
  }

  logger.info(`Reconciling ${stuckChecks.length} stale background check(s)`);

  const checkrClient = new CheckrClient();
  let updated = 0;
  let unparseable = 0;

  for (const check of stuckChecks) {
    const identityId = check.identityBackgroundCheckId;
    if (!identityId) continue;

    let raw: unknown;
    let effectiveId = identityId;
    try {
      // Prefer resolveReport (report fetch plus invitation recovery);
      // plain test doubles only expose getReport.
      if (typeof checkrClient.resolveReport === 'function') {
        const resolved = await checkrClient.resolveReport({
          reportId: identityId,
          invitationId: check.checkrInvitationId ?? null,
        });
        raw = resolved.report;
        effectiveId = resolved.reportId;
      } else {
        raw = await checkrClient.getReport(identityId);
      }
    } catch (error) {
      logger.error('Failed to fetch Checkr report', {
        backgroundCheckRequestId: check.id,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    if (!raw) {
      // Report missing in Checkr (deleted) or fetch returned nothing.
      // Advance lastSyncedAt so this row is not re-polled every hour.
      await db.backgroundCheckRequest.updateMany({
        where: { id: check.id, status: { in: NON_TERMINAL_STATUSES } },
        data: { lastSyncedAt: new Date() },
      });
      unparseable += 1;
      continue;
    }

    const { status: nextStatus, statuses } = parseIdentityCheckState(raw);
    // If direct parsing fails, try Checkr-specific handling
    let finalStatus = nextStatus;
    if (!finalStatus) {
      const mapped = mapCheckrReportToStatus(raw);
      const parsed = z.enum(backgroundCheckStatuses).safeParse(mapped);
      if (parsed.success) finalStatus = parsed.data;
    }

    if (!finalStatus) {
      // Status cannot be determined. Advance lastSyncedAt so this row backs
      // off instead of being re-fetched on every run.
      await db.backgroundCheckRequest.updateMany({
        where: { id: check.id, status: { in: NON_TERMINAL_STATUSES } },
        data: { lastSyncedAt: new Date() },
      });
      unparseable += 1;
      continue;
    }

    const data: Prisma.BackgroundCheckRequestUpdateManyMutationInput = {};
    // Graduate a stale invitation-id pointer once the report exists, so
    // later runs, webhooks, and manual sync hit the report directly.
    if (effectiveId !== identityId) {
      data.identityBackgroundCheckId = effectiveId;
    }
    if (finalStatus !== check.status) {
      data.status = finalStatus;
    }
    if (
      statuses?.identity !== undefined &&
      statuses.identity !== check.identityStatus
    ) {
      data.identityStatus = statuses.identity;
    }
    if (
      statuses?.employment !== undefined &&
      statuses.employment !== check.employmentStatus
    ) {
      data.employmentStatus = statuses.employment;
    }
    if (
      statuses?.references !== undefined &&
      statuses.references !== check.referenceStatus
    ) {
      data.referenceStatus = statuses.references;
    }
    if (
      statuses?.rightToWork !== undefined &&
      statuses.rightToWork !== check.rightToWorkStatus
    ) {
      data.rightToWorkStatus = statuses.rightToWork;
    }
    if (
      statuses?.adjudication !== undefined &&
      statuses.adjudication !== check.adjudicationStatus
    ) {
      data.adjudicationStatus = statuses.adjudication;
    }

    const hasChange = Object.keys(data).length > 0;
    if (hasChange) {
      const reportSnapshot = await fetchCompletedReportSnapshot({
        checkrClient,
        identityBackgroundCheckId: effectiveId,
        eventType: 'reconcile',
        status: finalStatus,
      });
      if (reportSnapshot) {
        data.reportSnapshot = reportSnapshot;
        data.reportSyncedAt = new Date();
      }
    }
    data.lastSyncedAt = new Date();

    const result = await db.backgroundCheckRequest.updateMany({
      where: { id: check.id, status: { in: NON_TERMINAL_STATUSES } },
      data,
    });

    if (result.count > 0 && hasChange) {
      updated += 1;
      if (data.status) {
        logger.info('Reconciled background check status', {
          backgroundCheckRequestId: check.id,
          from: check.status,
          to: finalStatus,
          provider: 'checkr',
        });
      }
    }
  }

  logger.info('Background-check reconciliation complete', {
    checked: stuckChecks.length,
    updated,
    unparseable,
    provider: 'checkr',
  });

  return { success: true, checked: stuckChecks.length, updated, unparseable };
}

export const reconcileBackgroundChecksSchedule = schedules.task({
  id: 'reconcile-background-checks-schedule',
  cron: '0 * * * *',
  maxDuration: 30 * 60,

  run: () => runReconciliation(),
});
