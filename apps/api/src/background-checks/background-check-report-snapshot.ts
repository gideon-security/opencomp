import { Logger } from '@nestjs/common';
import { Prisma } from '@db';
import type { BackgroundCheckStatus } from '@db';
import type { BackgroundCheckIdentityClient } from './background-check-identity.client';
import type { CheckrClient } from './checkr.client';

const logger = new Logger('BackgroundCheckReportSnapshot');

interface ReportCapableClient {
  getReport?: (id: string) => Promise<unknown>;
  getBackgroundCheck?: (id: string) => Promise<unknown>;
}

function shouldSyncReportSnapshot({
  status,
  eventType,
}: {
  status: BackgroundCheckStatus;
  eventType: string;
}): boolean {
  // Only fetch the full report for terminal states. report.updated fires for
  // every intermediate change (and is the default event type), so treating it
  // as completion would persist incomplete snapshots on each update.
  // Checkr uses report.completed; Convex used background_check.completed.
  const completedEvents = [
    'background_check.completed',
    'report.completed',
    'invitation.completed',
  ];
  return (
    completedEvents.includes(eventType) ||
    status === 'completed' ||
    status === 'completed_with_flags'
  );
}

function toInputJsonValue(value: unknown): Prisma.InputJsonValue | null {
  if (value === null || value === undefined) {
    return null;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function fetchCompletedReportSnapshot({
  identityClient,
  checkrClient,
  identityBackgroundCheckId,
  eventType,
  status,
}: {
  identityClient?: BackgroundCheckIdentityClient;
  checkrClient?: CheckrClient;
  identityBackgroundCheckId: string;
  eventType: string;
  status: BackgroundCheckStatus;
}): Promise<Prisma.InputJsonValue | null> {
  if (!shouldSyncReportSnapshot({ status, eventType })) {
    return null;
  }

  try {
    const client: ReportCapableClient | undefined =
      checkrClient ?? identityClient;
    let snapshot: unknown;
    if (client?.getReport) {
      snapshot = await client.getReport(identityBackgroundCheckId);
    } else if (client?.getBackgroundCheck) {
      snapshot = await client.getBackgroundCheck(identityBackgroundCheckId);
    } else {
      return null;
    }
    return toInputJsonValue(snapshot);
  } catch (error) {
    // Never fail the caller on a snapshot fetch: the status update must
    // still commit. Log loudly instead — a terminal row that commits without
    // a snapshot can only be backfilled via manual sync.
    logger.warn(
      'Checkr report snapshot fetch failed; committing status without a snapshot',
      {
        identityBackgroundCheckId,
        eventType,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    return null;
  }
}
