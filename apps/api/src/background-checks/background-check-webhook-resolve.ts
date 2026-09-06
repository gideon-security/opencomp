import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { BackgroundCheckStatus, db } from '@db';
import { createHash } from 'node:crypto';
import { headerValue } from '../utils/webhook-signature';

/**
 * Webhook record resolution: event identity derivation plus tenant-checked
 * row lookup. Separated from background-check-webhook.ts (event
 * persistence) to keep both files under the 300-line limit.
 */

const logger = new Logger('CheckrWebhookResolve');

export type WebhookResolutionVia = 'direct' | 'candidate' | 'member';

/**
 * Hash of the full payload. Feeds the dedup-key fallback so two distinct
 * same-type deliveries for one report never share a key: hashing only a
 * few fields would collapse deliveries that differ elsewhere (e.g. same
 * status but different sub-statuses) and swallow the transition.
 */
export function fingerprintReport(data: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(data ?? null))
    .digest('hex')
    .slice(0, 16);
}

/**
 * An indirectly resolved report event must never rewind a graduated
 * pointer: a late event for a superseded report still matches via the
 * candidate or member fallback after a retry swapped in a fresh check.
 * The superseded-pointer list tells the two cases apart. An event naming
 * a superseded report is the old attempt arriving late. Any other event
 * against an ungraduated (invitation-placeholder) pointer is the report
 * arriving — including the first report for a retried row, whose pointer
 * is a NEW invitation id that can never match directly. (On a retried row
 * that verdict is provisional: applyWebhookEvent re-verifies against the
 * vendor, because the superseded list may hold the prior attempt's
 * invitation id, which a late report from that attempt can never equal.)
 */
export function isStaleIndirectEvent({
  via,
  isReportEvent,
  record,
  reportId,
}: {
  via: WebhookResolutionVia;
  isReportEvent: boolean;
  record: {
    identityBackgroundCheckId: string | null;
    checkrInvitationId: string | null;
    supersededIdentityBackgroundCheckIds: string[];
  };
  reportId: string;
}): boolean {
  if (via === 'direct' || !isReportEvent) return false;
  if (!record.identityBackgroundCheckId) return false;
  if (record.identityBackgroundCheckId === reportId) return false;
  if ((record.supersededIdentityBackgroundCheckIds ?? []).includes(reportId)) {
    return true;
  }
  if (record.identityBackgroundCheckId === record.checkrInvitationId) {
    return false;
  }
  return true;
}

/**
 * Maximum age of a webhook delivery. Checkr sends no delivery-timestamp
 * header, so freshness comes from the payload's own event time. A delivery
 * older than the window is a replay or a vendor retry past usefulness:
 * reject it before the dedup insert so the retry can never apply. Vendor
 * retries land within hours; missed updates still heal through manual sync
 * and hourly reconcile, so the window stays short enough that a captured
 * delivery stops being replayable after a day.
 */
export const WEBHOOK_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Tolerance for vendor clock skew. A delivery dated further in the future
 * than this never goes stale by age alone, so it is rejected outright.
 */
export const WEBHOOK_FUTURE_SKEW_MS = 5 * 60 * 1000;

/**
 * One candidate timestamp to epoch milliseconds. Accepts epoch numbers
 * (seconds or milliseconds), numeric strings, and ISO-8601 strings in
 * either camelCase or snake_case keys — Checkr report objects carry
 * snake_case ISO strings, which the old numeric-only read ignored and
 * made the age guard dead code on real payloads.
 */
function timestampToMs(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;
    if (/^-?\d+(\.\d+)?$/.test(text)) {
      const numeric = Number(text);
      if (!Number.isFinite(numeric)) return null;
      return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
    }
    const parsed = Date.parse(text);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Newest event timestamp in the payload as epoch milliseconds. Accepts
 * either the inner report object or the full envelope (which carries the
 * report under `data`) so stored marker payloads read the same way live
 * deliveries do. Returns null when the payload carries no usable timestamp
 * (invitation lifecycle events).
 */
export function webhookEventTimeMs(value: unknown): number | null {
  const inner: unknown =
    typeof value === 'object' && value !== null && 'data' in value
      ? value.data
      : value;
  const data: unknown =
    typeof inner === 'object' && inner !== null ? inner : value;
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  let latest: number | null = null;
  for (const candidate of [
    record.updatedAt,
    record.updated_at,
    record.completedAt,
    record.completed_at,
    record.createdAt,
    record.created_at,
  ]) {
    const ms = timestampToMs(candidate);
    if (ms === null) continue;
    if (latest === null || ms > latest) latest = ms;
  }
  return latest;
}

/**
 * Age of the delivery in milliseconds, from the newest event timestamp in
 * the payload. Returns null when the payload carries no usable timestamp
 * (invitation lifecycle events) — those skip the freshness check and rely
 * on HMAC plus dedup. Negative when the payload is dated in the future.
 */
export function webhookEventAgeMs(
  data: Record<string, unknown>,
): number | null {
  const latest = webhookEventTimeMs(data);
  if (latest === null) return null;
  return Date.now() - latest;
}

export function deriveWebhookEventIdentity({
  headers,
  envelopeId,
  envelopeType,
  reportId,
  reportFingerprint,
}: {
  headers: Record<string, string | string[] | undefined>;
  envelopeId?: string;
  envelopeType?: string;
  reportId: string;
  /**
   * Hash of the full payload. Only used when no event id exists anywhere:
   * without it, two distinct `report.updated` deliveries for one report
   * collapse into a single dedup key and the second transition is swallowed.
   */
  reportFingerprint?: string;
}): { eventId: string; eventType: string } {
  const eventType =
    envelopeType ??
    headerValue(headers, 'x-checkr-event-type') ??
    'report.updated';
  // Fall back to report+type+fingerprint, never the bare report id: two
  // distinct events for one report (e.g. report.updated then
  // report.completed, or two report.updated with different states) must
  // not collapse into a single dedup key and swallow the transition.
  const eventId =
    headerValue(headers, 'x-checkr-event-id') ??
    envelopeId ??
    `${reportId}:${eventType}:${reportFingerprint ?? 'nofp'}`;
  return { eventId, eventType };
}

export async function resolveWebhookRecord({
  reportId,
  candidateId,
  metadata,
}: {
  reportId: string;
  candidateId?: string;
  metadata?: {
    compOrganizationId?: string;
    compMemberId?: string;
  };
}): Promise<{
  record: {
    id: string;
    organizationId: string;
    memberId: string;
    status: BackgroundCheckStatus;
    employeeName: string;
    employeeEmail: string;
    identityBackgroundCheckId: string | null;
    checkrInvitationId: string | null;
    supersededIdentityBackgroundCheckIds: string[];
    rerunCount: number;
  };
  via: WebhookResolutionVia;
}> {
  // Resolve by Checkr-native ids only. There is deliberately no email
  // fallback: webhooks carry no organizationId, so matching on bare
  // employeeEmail could resolve (and overwrite) another tenant's row.
  const direct = await db.backgroundCheckRequest.findFirst({
    where: { identityBackgroundCheckId: reportId },
  });

  let resolved: typeof direct = null;
  let via: WebhookResolutionVia = 'direct';
  if (direct) {
    resolved = direct;
  } else {
    const orgId = metadata?.compOrganizationId;
    const memberId = metadata?.compMemberId;

    if (candidateId && orgId && memberId) {
      // The candidate id is shared across organizations for the same email,
      // so the fallback stays scoped to the tenant Checkr echoes in
      // metadata. Without both metadata fields there is no safe scoping —
      // a global lookup could resolve another tenant's row.
      resolved = await db.backgroundCheckRequest.findFirst({
        where: {
          checkrCandidateId: candidateId,
          organizationId: orgId,
          memberId,
        },
      });
      if (resolved) via = 'candidate';
    }

    if (!resolved && orgId && memberId) {
      // A member holds at most one check (unique org+member), so metadata
      // alone resolves the row for events that carry neither a known report
      // id nor a candidate id — e.g. the first report event for an invited
      // row whose pointer is still the invitation id.
      resolved = await db.backgroundCheckRequest.findFirst({
        where: { organizationId: orgId, memberId },
      });
      if (resolved) via = 'member';
    }
  }

  if (!resolved) {
    logger.warn('Checkr webhook arrived for an unknown background check', {
      reportId,
      hasCandidateId: !!candidateId,
      hasMetadata: !!(metadata?.compOrganizationId && metadata?.compMemberId),
    });
    throw new NotFoundException('Background check request not found.');
  }

  // When Checkr echoes the metadata written at candidate creation,
  // cross-check it against the resolved row — on every path, including the
  // direct hit. A misdirected payload must not overwrite another tenant.
  if (
    metadata?.compOrganizationId &&
    metadata.compOrganizationId !== resolved.organizationId
  ) {
    throw new BadRequestException('Webhook organization mismatch.');
  }
  if (metadata?.compMemberId && metadata.compMemberId !== resolved.memberId) {
    throw new BadRequestException('Webhook member mismatch.');
  }

  return { record: resolved, via };
}
