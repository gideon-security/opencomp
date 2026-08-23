/**
 * Shared ids for the Internal Audit document (CS-724). Every user-visible
 * label resolves through internal-audit-labels.ts under
 * `isms.internalAuditValidation`. The server enforces the same submit rules
 * in assertInternalAuditComplete (documents/internal-audit.ts) — keep in sync.
 */

export const AUDIT_STATUSES = ['planned', 'in_progress', 'complete'] as const;

export const CONCLUSION_VERDICTS = [
  'conform',
  'substantially_conform',
  'not_yet_conform',
] as const;

export const CONTROL_RESULTS = [
  'conformity_confirmed',
  'nonconformity_raised',
  'observation_raised',
  'not_sampled',
] as const;

export const FINDING_TYPES = [
  'nc_major',
  'nc_minor',
  'ofi',
  'observation',
] as const;

export const FINDING_STATUSES = ['open', 'in_progress', 'closed'] as const;

/** Read the Programme paragraph out of the document's draft narrative. */
export function parseProgramme(narrative: unknown): string {
  if (
    narrative &&
    typeof narrative === 'object' &&
    'programme' in narrative &&
    typeof (narrative as { programme: unknown }).programme === 'string'
  ) {
    return (narrative as { programme: string }).programme;
  }
  return '';
}
