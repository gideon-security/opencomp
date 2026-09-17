import type { EvidenceFormType } from './form-types';

// NOTE: This package intentionally does NOT import from '@prisma/client'.
// The generated client is only populated by `db:generate` (packages/db) into a
// single pnpm store variant, so a value import of the EvidenceFormType enum
// breaks this package's build whenever generation hasn't run or resolves to a
// different store copy (CI: "has no exported member 'EvidenceFormType'").
// The DB enum members are identical to their string values
// (e.g. board_meeting = 'board_meeting'), so the snake_case string union
// below is assignment-compatible with Prisma's EvidenceFormType in both
// directions.

export const EXTERNAL_TO_DB_EVIDENCE_FORM_TYPE = {
  'board-meeting': 'board_meeting',
  'it-leadership-meeting': 'it_leadership_meeting',
  'risk-committee-meeting': 'risk_committee_meeting',
  meeting: 'meeting',
  'access-request': 'access_request',
  'whistleblower-report': 'whistleblower_report',
  'penetration-test': 'penetration_test',
  'rbac-matrix': 'rbac_matrix',
  'infrastructure-inventory': 'infrastructure_inventory',
  'employee-performance-evaluation': 'employee_performance_evaluation',
  'network-diagram': 'network_diagram',
  'tabletop-exercise': 'tabletop_exercise',
  'account-types': 'account_types',
} as const satisfies Record<EvidenceFormType, string>;

export type DbEvidenceFormTypeValue = (typeof EXTERNAL_TO_DB_EVIDENCE_FORM_TYPE)[EvidenceFormType];

/**
 * DB-side evidence form type. Same string literals as Prisma's
 * EvidenceFormType enum — kept local so this package builds without the
 * generated Prisma client.
 */
export type DbEvidenceFormType = DbEvidenceFormTypeValue;

export const DB_TO_EXTERNAL_EVIDENCE_FORM_TYPE = {
  board_meeting: 'board-meeting',
  it_leadership_meeting: 'it-leadership-meeting',
  risk_committee_meeting: 'risk-committee-meeting',
  meeting: 'meeting',
  access_request: 'access-request',
  whistleblower_report: 'whistleblower-report',
  penetration_test: 'penetration-test',
  rbac_matrix: 'rbac-matrix',
  infrastructure_inventory: 'infrastructure-inventory',
  employee_performance_evaluation: 'employee-performance-evaluation',
  network_diagram: 'network-diagram',
  tabletop_exercise: 'tabletop-exercise',
  account_types: 'account-types',
} as const satisfies Record<DbEvidenceFormTypeValue, EvidenceFormType>;

export function toDbEvidenceFormTypeValue(formType: EvidenceFormType): DbEvidenceFormTypeValue {
  return EXTERNAL_TO_DB_EVIDENCE_FORM_TYPE[formType];
}

export function toExternalEvidenceFormTypeValue(
  formType: DbEvidenceFormTypeValue | null | undefined,
): EvidenceFormType | null {
  if (!formType) return null;
  return DB_TO_EXTERNAL_EVIDENCE_FORM_TYPE[formType];
}

export function toDbEvidenceFormType(formType: EvidenceFormType): DbEvidenceFormType {
  return toDbEvidenceFormTypeValue(formType);
}

export function toExternalEvidenceFormType(
  formType: DbEvidenceFormType | null | undefined,
): EvidenceFormType | null {
  if (!formType) return null;
  return toExternalEvidenceFormTypeValue(formType);
}
