import {
  BadRequestException,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@db';
import type { BackgroundCheckStatus } from '@db';
import type { BackgroundCheckIdentityClient } from './background-check-identity.client';
import type { CheckrClient } from './checkr.client';

const logger = new Logger('BackgroundCheckReportSnapshot');

interface ReportCapableClient {
  getReport?: (id: string) => Promise<unknown>;
  getBackgroundCheck?: (id: string) => Promise<unknown>;
  resolveReport?: (params: {
    reportId: string;
    invitationId?: string | null;
  }) => Promise<{ report: unknown; reportId: string }>;
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
  // invitation.completed is deliberately absent: it means the candidate
  // finished the hosted form, not that a report exists. Snapshotting on it
  // would persist the invitation payload as the report snapshot.
  const completedEvents = ['background_check.completed', 'report.completed'];
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
  invitationId,
  eventType,
  status,
}: {
  identityClient?: BackgroundCheckIdentityClient;
  checkrClient?: CheckrClient;
  identityBackgroundCheckId: string;
  /**
   * The row's invitation id, when the pointer may still be the invitation
   * placeholder. Lets the fetch graduate to the real report instead of
   * snapshotting nothing (or the invitation itself).
   */
  invitationId?: string | null;
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
    if (invitationId && client?.resolveReport) {
      const resolved = await client.resolveReport({
        reportId: identityBackgroundCheckId,
        invitationId,
      });
      snapshot = resolved.report;
    } else if (client?.getReport) {
      snapshot = await client.getReport(identityBackgroundCheckId);
    } else if (client?.getBackgroundCheck) {
      snapshot = await client.getBackgroundCheck(identityBackgroundCheckId);
    } else {
      // No capable client: a wanted terminal snapshot cannot be produced.
      // Throw like a fetch failure so the caller backs off instead of
      // committing a terminal row with no snapshot.
      throw new ServiceUnavailableException(
        'Checkr report snapshot is not available yet.',
      );
    }
    const value = toInputJsonValue(snapshot);
    if (value === null) {
      // A terminal snapshot was wanted but the report could not be read
      // (vendor blip, eventual-consistency 404). Throw so the caller backs
      // off and retries later instead of committing a terminal row with no
      // snapshot that webhooks can never backfill.
      throw new ServiceUnavailableException(
        'Checkr report snapshot is not available yet.',
      );
    }
    return value;
  } catch (error) {
    if (error instanceof ServiceUnavailableException) throw error;
    // Auth failures must surface to the operator, not dissolve into a
    // backoff: a bad key never heals by waiting. A missing key (BadRequest
    // from apiKey()) is the same: wrapping it in 503 would tell callers to
    // retry a configuration that can never heal.
    if (error instanceof UnauthorizedException) throw error;
    if (error instanceof BadRequestException) throw error;
    // A wanted terminal snapshot that cannot be read must back off and
    // retry later — never commit a terminal row with no snapshot that
    // webhooks can never backfill.
    logger.warn('Checkr report snapshot fetch failed; backing off', {
      identityBackgroundCheckId,
      eventType,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new ServiceUnavailableException(
      'Checkr report snapshot is not available yet.',
    );
  }
}
