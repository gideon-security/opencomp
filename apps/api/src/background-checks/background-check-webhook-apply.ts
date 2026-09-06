import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { BackgroundCheckStatus, db } from '@db';
import type { CheckrClient } from './checkr.client';
import { fetchCompletedReportSnapshot } from './background-check-report-snapshot';
import { processWebhookEvent } from './background-check-webhook-process';
import {
  isStaleIndirectEvent,
  resolveWebhookRecord,
} from './background-check-webhook-resolve';
import { parseInvitationReportId } from './checkr.utils';
import {
  isTerminalBackgroundCheckStatus,
  shouldWriteWebhookStatus,
} from './background-checks.types';

const logger = new Logger('CheckrWebhook');

/**
 * Record a deliberately-ignored event as applied so a redelivery acks
 * duplicate instead of reprocessing. The request link is filled in with
 * the apply, inside the transaction in processWebhookEvent — never ahead
 * of the commit, or a crash between the link and the commit would poison
 * the reclaim predicate.
 */
async function ackIgnoredEvent({
  eventId,
  requestId,
}: {
  eventId: string;
  requestId: string;
}): Promise<void> {
  await db.backgroundCheckWebhookEvent.updateMany({
    where: { eventId, appliedAt: null },
    data: { backgroundCheckRequestId: requestId, appliedAt: new Date() },
  });
}

/**
 * Confirm an ambiguous report event belongs to the row's current
 * invitation. A retried row whose pointer is still an invitation
 * placeholder cannot prove this locally: the superseded list may hold the
 * prior attempt's invitation id, which a report id can never equal, so a
 * late report from the prior attempt looks identical to the new report
 * arriving. The vendor breaks the tie — the current invitation names its
 * report once the candidate completes the flow. Returns null when the
 * client cannot read invitations (minimal doubles): callers keep the
 * legacy accept. Throws ServiceUnavailableException when the invitation
 * cannot be read, so the caller releases the marker and the vendor retry
 * reprocesses instead of risking the wrong report on the row.
 */
async function verifyReportMatchesCurrentInvitation({
  identityClient,
  invitationId,
  reportId,
}: {
  identityClient: CheckrClient;
  invitationId: string;
  reportId: string;
}): Promise<boolean | null> {
  if (typeof identityClient.getInvitation !== 'function') return null;
  const invitation = await identityClient.getInvitation(invitationId);
  if (!invitation) {
    throw new ServiceUnavailableException(
      'Checkr invitation is not readable yet.',
    );
  }
  return parseInvitationReportId(invitation) === reportId;
}

/**
 * Resolve, validate, and apply one claimed delivery. Separated from
 * background-check-webhook.ts (request parsing plus dedup claim) to keep
 * both files under the 300-line limit.
 */
export async function applyWebhookEvent({
  reportId,
  candidateId,
  metadata,
  eventId,
  eventType,
  eventTimeMs,
  isReportEvent,
  status,
  rawStatus,
  candidateName,
  candidateEmail,
  statuses,
  identityClient,
}: {
  reportId: string;
  candidateId?: string;
  metadata?: {
    compOrganizationId?: string;
    compMemberId?: string;
  };
  eventId: string;
  eventType: string;
  /** Vendor event time of this delivery; null when the payload has none. */
  eventTimeMs: number | null;
  isReportEvent: boolean;
  status: BackgroundCheckStatus | null;
  rawStatus?: string;
  candidateName?: string;
  candidateEmail?: string;
  statuses?: {
    identity?: string;
    employment?: string;
    references?: string;
    rightToWork?: string;
    adjudication?: string;
  };
  identityClient: CheckrClient;
}): Promise<{ ok: true; duplicate?: true }> {
  const { record, via } = await resolveWebhookRecord({
    reportId,
    candidateId,
    metadata,
  });

  // An indirectly resolved report event must never rewind a graduated
  // pointer (see isStaleIndirectEvent): a late event for a superseded
  // report still matches via fallback after a retry swapped in a check.
  if (
    isStaleIndirectEvent({ via, isReportEvent, record, reportId: reportId })
  ) {
    logger.warn('Ignoring stale indirect webhook event', {
      eventId,
      via,
      backgroundCheckRequestId: record.id,
    });
    // Record the decision atomically: the event was seen and deliberately
    // ignored, so a redelivery acks duplicate instead of reprocessing.
    await ackIgnoredEvent({ eventId, requestId: record.id });
    return { ok: true };
  }

  // An unmatched indirect report against a retried row's ungraduated
  // pointer is ambiguous: the superseded list may hold the prior attempt's
  // invitation id (which a report id can never equal), so a late report
  // from the prior attempt is indistinguishable from the new report
  // arriving. First-attempt rows skip this — with no retry history the
  // event can only be the invitation's own report. Otherwise verify
  // against the vendor before letting the old check's result graduate the
  // new attempt.
  const superseded = record.supersededIdentityBackgroundCheckIds ?? [];
  if (
    via !== 'direct' &&
    isReportEvent &&
    record.identityBackgroundCheckId !== null &&
    record.identityBackgroundCheckId === record.checkrInvitationId &&
    record.checkrInvitationId &&
    superseded.length > 0 &&
    !superseded.includes(reportId)
  ) {
    const verified = await verifyReportMatchesCurrentInvitation({
      identityClient,
      invitationId: record.checkrInvitationId,
      reportId,
    });
    if (verified === false) {
      logger.warn('Ignoring foreign report for a retried invitation row', {
        eventId,
        via,
        backgroundCheckRequestId: record.id,
      });
      await ackIgnoredEvent({ eventId, requestId: record.id });
      return { ok: true };
    }
  }

  // Invitation events describe the hosted flow (created/completed/expired),
  // not the report. They may advance in-flight state but must never
  // terminalize the row — except an expired or deleted invitation on a
  // still-invited row, which can never produce a report (see
  // shouldWriteWebhookStatus). A null status (status-less event) never
  // writes: there is no transition to apply.
  const writeStatus = shouldWriteWebhookStatus({
    isReportEvent,
    status,
    recordStatus: record.status,
    rawStatus,
  });
  const effectiveStatus = writeStatus && status ? status : record.status;

  // Fast path: the row is already terminal, so no snapshot is needed and
  // none is fetched (a fetch failure must not 500 an event that changes
  // nothing). processWebhookEvent re-checks inside the transaction and
  // marks the marker applied.
  if (isTerminalBackgroundCheckStatus(record.status)) {
    return processWebhookEvent({
      record,
      eventId,
      eventTimeMs,
      payloadId: reportId,
      candidateId,
      isReportEvent,
      status,
      rawStatus,
      candidateName,
      candidateEmail,
      statuses,
      reportSnapshot: null,
      via,
    });
  }

  // Fetch the report snapshot BEFORE the transaction below. Network I/O
  // must never run inside an interactive transaction: a slow vendor
  // response holds database locks and trips the transaction timeout.
  // A fetch failure throws: the marker is released by the caller and the
  // vendor retry reprocesses, instead of committing a terminal row with no
  // snapshot that can never heal via webhook.
  const reportSnapshot = await fetchCompletedReportSnapshot({
    identityClient,
    identityBackgroundCheckId: reportId,
    invitationId: record.checkrInvitationId,
    eventType,
    status: effectiveStatus,
  });

  return processWebhookEvent({
    record,
    eventId,
    eventTimeMs,
    payloadId: reportId,
    candidateId,
    isReportEvent,
    status,
    rawStatus,
    candidateName,
    candidateEmail,
    statuses,
    reportSnapshot,
    via,
  });
}
