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
        candidate_id: z.string().optional(),
        adjudication: z.string().optional(),
        candidateName: z.string().optional(),
        candidateEmail: z.string().email().optional(),
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

// Legacy Convex schema — removed, Checkr native only. Kept type for DB migration compat if needed.
export const identityWebhookPayloadSchema = z.object({
  eventId: z.string(),
  type: z.string(),
  apiVersion: z.string().optional(),
  data: z.object({
    id: z.string(),
    status: z.enum(backgroundCheckStatuses),
    candidateName: z.string().optional(),
    candidateEmail: z.string().email().optional(),
    metadata: z.object({
      source: z.string().optional(),
      compOrganizationId: z.string(),
      compMemberId: z.string(),
    }),
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
  }),
});

export type IdentityCreateResponse = z.infer<
  typeof identityCreateResponseSchema
>;

export type CheckrWebhookPayload = z.infer<typeof checkrWebhookPayloadSchema>;

export function mapCheckrReportToStatus(report: unknown): string {
  if (!report || typeof report !== 'object') return '';
  const r = report as { status?: string; adjudication?: string };
  const rawStatus = r.status || '';
  const lowerStatus = rawStatus.toLowerCase();
  const adjudication = (r.adjudication || '').toLowerCase();
  // If status is already a valid BackgroundCheckStatus, return as is
  if ((backgroundCheckStatuses as readonly string[]).includes(rawStatus)) {
    return rawStatus;
  }
  if ((backgroundCheckStatuses as readonly string[]).includes(lowerStatus)) {
    return lowerStatus;
  }
  if (lowerStatus === 'clear') return 'completed';
  if (lowerStatus === 'consider' && adjudication === 'engaged')
    return 'completed_with_flags';
  if (lowerStatus === 'suspended' || lowerStatus === 'disputed')
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
