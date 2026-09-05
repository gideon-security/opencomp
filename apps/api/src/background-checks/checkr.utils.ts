/**
 * Pure helpers for the Checkr integration. No I/O, no env access —
 * safe to unit-test in isolation.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function splitName(fullName: string): {
  first_name: string;
  last_name: string;
} {
  const trimmed = fullName.trim().replace(/\s+/g, ' ');
  if (!trimmed) return { first_name: '', last_name: '' };
  const parts = trimmed.split(' ');
  if (parts.length === 1) {
    // Mononym: never fabricate a last name from the first name.
    // Checkr rejects the request if it requires a last name.
    return { first_name: parts[0], last_name: '' };
  }
  const first = parts[0];
  const last = parts.slice(1).join(' ');
  return { first_name: first, last_name: last };
}

/** Extract the report id from an invitation payload, if one exists yet. */
export function parseInvitationReportId(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const report = value.report;
  const reportId = value.report_id ?? (isRecord(report) ? report.id : null);
  return typeof reportId === 'string' && reportId ? reportId : null;
}
