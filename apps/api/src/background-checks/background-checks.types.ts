import { z } from 'zod';

export const backgroundCheckStatuses = [
  'invited',
  'in_progress',
  'in_review',
  'completed',
  'completed_with_flags',
  'failed',
  'cancelled',
] as const;

// Webhook and reconcile must never move a row out of a terminal state.
// A stale or replayed event for an in-flight status must not regress a
// finished check.
export const terminalBackgroundCheckStatuses = [
  'completed',
  'completed_with_flags',
  'failed',
  'cancelled',
] as const;

export function isTerminalBackgroundCheckStatus(status: string): boolean {
  return (terminalBackgroundCheckStatuses as readonly string[]).includes(
    status,
  );
}

export const identityCreateResponseSchema = z.object({
  id: z.string(),
  status: z.enum(backgroundCheckStatuses),
  candidateUrl: z.string().url().nullable().optional(),
  candidateId: z.string().nullable().optional(),
  invitationId: z.string().nullable().optional(),
});

export const checkrWebhookPayloadSchema = z
  .object({
    id: z.string().optional(),
    type: z.string().optional(),
    data: z
      .object({
        object: z.string().optional(),
        id: z.string(),
        status: z.string().optional(),
        result: z.string().optional(),
        candidate_id: z.string().optional(),
        adjudication: z.string().optional(),
        candidateName: z.string().optional(),
        // Display-only vendor data: a malformed address must never fail the
        // whole payload (that would 400 every vendor retry and wedge the
        // status transition). Plausibility is checked at write time instead.
        candidateEmail: z.string().optional(),
        metadata: z
          .object({
            source: z.string().optional(),
            compOrganizationId: z.string().optional(),
            compMemberId: z.string().optional(),
          })
          .passthrough()
          .optional(),
        statuses: z
          .object({
            identity: z.string().optional(),
            employment: z.string().optional(),
            references: z.string().optional(),
            rightToWork: z.string().optional(),
            adjudication: z.string().optional(),
          })
          .optional(),
        createdAt: z.number().nullable().optional(),
        updatedAt: z.number().nullable().optional(),
        completedAt: z.number().nullable().optional(),
      })
      .passthrough(),
    object: z.string().optional(),
    status: z.string().optional(),
    adjudication: z.string().optional(),
    candidate_id: z.string().optional(),
  })
  .passthrough();

export type IdentityCreateResponse = z.infer<
  typeof identityCreateResponseSchema
>;

export type CheckrWebhookPayload = z.infer<typeof checkrWebhookPayloadSchema>;

export function mapCheckrReportToStatus(report: unknown): string {
  if (!report || typeof report !== 'object') return '';
  const r = report as {
    status?: unknown;
    adjudication?: unknown;
    result?: unknown;
  };
  // Vendor payloads arrive unvalidated: a non-string status or adjudication
  // must back off as unparseable (''), never throw inside sync/reconcile.
  const rawStatus = typeof r.status === 'string' ? r.status : '';
  const lowerStatus = rawStatus.toLowerCase();
  const adjudication =
    typeof r.adjudication === 'string' ? r.adjudication.toLowerCase() : '';
  const result = typeof r.result === 'string' ? r.result.toLowerCase() : '';
  // If status is already a valid BackgroundCheckStatus, return as is
  if ((backgroundCheckStatuses as readonly string[]).includes(rawStatus)) {
    return rawStatus;
  }
  if ((backgroundCheckStatuses as readonly string[]).includes(lowerStatus)) {
    return lowerStatus;
  }
  // Current Checkr report lifecycle: a finished report carries
  // status "complete" with the outcome in "result" ("clear" | "consider").
  if (lowerStatus === 'complete') {
    if (result === 'consider' || adjudication === 'engaged') {
      return 'completed_with_flags';
    }
    return 'completed';
  }
  if (lowerStatus === 'clear') return 'completed';
  if (lowerStatus === 'consider' && adjudication === 'engaged')
    return 'completed_with_flags';
  if (
    lowerStatus === 'suspended' ||
    lowerStatus === 'disputed' ||
    lowerStatus === 'dispute'
  )
    return 'in_review';
  if (lowerStatus === 'consider' || lowerStatus === 'review')
    return 'in_review';
  if (lowerStatus === 'pending' || lowerStatus === 'in_progress')
    return 'in_progress';
  if (lowerStatus === 'canceled' || lowerStatus === 'cancelled')
    return 'cancelled';
  if (lowerStatus === 'failed') return 'failed';
  // Invitation lifecycle states (Checkr invitations expire after 7 days).
  // An expired invitation can never produce a report, so the check failed
  // and may be retried. A deleted invitation maps to cancelled.
  if (lowerStatus === 'expired') return 'failed';
  if (lowerStatus === 'deleted') return 'cancelled';
  // Unknown and absent statuses are unparseable, never "invited": callers
  // back off on '' instead of writing a fabricated state.
  return '';
}

/**
 * Invitation events describe the hosted flow, not the report. They may
 * advance in-flight state but must never terminalize the row — except an
 * expired or deleted invitation on a still-invited row. That invitation can
 * never produce a report, so the failure is real and the row would otherwise
 * deadlock: sync backs off on a missing report and retry rejects `invited`.
 */
export function shouldWriteWebhookStatus({
  isReportEvent,
  status,
  recordStatus,
  rawStatus,
}: {
  isReportEvent: boolean;
  status: string | null;
  recordStatus: string;
  rawStatus?: string;
}): boolean {
  if (status === null) return false;
  if (isReportEvent) return true;
  if (!isTerminalBackgroundCheckStatus(status)) return true;
  if (recordStatus !== 'invited') return false;
  const lower = rawStatus?.toLowerCase();
  return lower === 'expired' || lower === 'deleted';
}

/**
 * Vendor email is display data, never a routing key. Accept the payload's
 * value only when it looks like an address; otherwise keep the stored one
 * so a garbage vendor field cannot overwrite the real employee email.
 */
export function normalizeWebhookEmail({
  candidateEmail,
  currentEmail,
}: {
  candidateEmail?: string;
  currentEmail: string;
}): string {
  if (!candidateEmail) return currentEmail;
  const ok = z.string().email().safeParse(candidateEmail).success;
  return ok ? candidateEmail : currentEmail;
}
