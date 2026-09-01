import { BadRequestException, NotFoundException } from '@nestjs/common';
import { db } from '@db';
import { headerValue } from './background-check-webhook-signature';

/**
 * Webhook record resolution: event identity derivation plus tenant-checked
 * row lookup. Separated from background-check-webhook.ts (event
 * persistence) to keep both files under the 300-line limit.
 */

export function deriveWebhookEventIdentity({
  headers,
  envelopeId,
  envelopeType,
  reportId,
}: {
  headers: Record<string, string | string[] | undefined>;
  envelopeId?: string;
  envelopeType?: string;
  reportId: string;
}): { eventId: string; eventType: string } {
  const eventType =
    envelopeType ??
    headerValue(headers, 'x-checkr-event-type') ??
    'report.updated';
  // Fall back to report+type, not the bare report id: two distinct event
  // types for one report (e.g. report.updated then report.completed) must
  // not collapse into a single dedup key and swallow the transition.
  const eventId =
    headerValue(headers, 'x-checkr-event-id') ??
    envelopeId ??
    `${reportId}:${eventType}`;
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
}) {
  // Resolve by Checkr-native ids only. There is deliberately no email
  // fallback: webhooks carry no organizationId, so matching on bare
  // employeeEmail could resolve (and overwrite) another tenant's row.
  const record = await db.backgroundCheckRequest.findFirst({
    where: { identityBackgroundCheckId: reportId },
  });

  let resolved = record;
  if (!resolved && candidateId) {
    // The candidate id is shared across organizations for the same email,
    // so scope the fallback by metadata when Checkr echoes it. Without
    // metadata the lookup stays global — the id itself is unguessable and
    // the HMAC gates who may send it.
    resolved =
      metadata?.compOrganizationId && metadata?.compMemberId
        ? await db.backgroundCheckRequest.findFirst({
            where: {
              checkrCandidateId: candidateId,
              organizationId: metadata.compOrganizationId,
              memberId: metadata.compMemberId,
            },
          })
        : await db.backgroundCheckRequest.findFirst({
            where: { checkrCandidateId: candidateId },
          });
  }

  if (!resolved) {
    throw new NotFoundException('Background check request not found.');
  }

  // When Checkr echoes the metadata written at candidate creation,
  // cross-check it against the resolved row. The lookup above can be
  // global, so a misdirected payload must not overwrite another tenant.
  if (
    metadata?.compOrganizationId &&
    metadata.compOrganizationId !== resolved.organizationId
  ) {
    throw new BadRequestException('Webhook organization mismatch.');
  }
  if (metadata?.compMemberId && metadata.compMemberId !== resolved.memberId) {
    throw new BadRequestException('Webhook member mismatch.');
  }

  return resolved;
}
