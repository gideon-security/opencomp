import type { useTranslations } from 'next-intl';
import type { IsmsAudit } from '../isms-types';
import type {
  IsmsAuditConclusionVerdict,
  IsmsAuditControlResult,
  IsmsAuditFindingStatus,
  IsmsAuditFindingType,
  IsmsAuditStatus,
} from '../isms-types';

/**
 * Translated lookups for the clause-9.2 Internal Audit labels + validation
 * copy (CS-724). The id arrays live in internal-audit-constants.ts; every
 * user-visible string resolves here under `isms.internalAuditValidation`.
 * The server enforces the same submit rules in assertInternalAuditComplete
 * (documents/internal-audit.ts) — keep in sync.
 */
export type InternalAuditTranslator = ReturnType<typeof useTranslations<'isms'>>;

export function auditStatusLabel(t: InternalAuditTranslator, status: IsmsAuditStatus): string {
  switch (status) {
    case 'planned':
      return t('internalAuditValidation.statuses.planned');
    case 'in_progress':
      return t('internalAuditValidation.statuses.inProgress');
    default:
      return t('internalAuditValidation.statuses.complete');
  }
}

export function conclusionVerdictLabel(
  t: InternalAuditTranslator,
  verdict: IsmsAuditConclusionVerdict,
): string {
  switch (verdict) {
    case 'conform':
      return t('internalAuditValidation.verdicts.conform');
    case 'substantially_conform':
      return t('internalAuditValidation.verdicts.substantiallyConform');
    default:
      return t('internalAuditValidation.verdicts.notYetConform');
  }
}

/** The assembled conclusion sentence shown in the read view + generated doc. */
export function conclusionSentence(
  t: InternalAuditTranslator,
  verdict: IsmsAuditConclusionVerdict,
): string {
  switch (verdict) {
    case 'conform':
      return t('internalAuditValidation.conclusions.conform');
    case 'substantially_conform':
      return t('internalAuditValidation.conclusions.substantiallyConform');
    default:
      return t('internalAuditValidation.conclusions.notYetConform');
  }
}

export function controlResultLabel(
  t: InternalAuditTranslator,
  result: IsmsAuditControlResult,
): string {
  switch (result) {
    case 'conformity_confirmed':
      return t('internalAuditValidation.controlResults.conformityConfirmed');
    case 'nonconformity_raised':
      return t('internalAuditValidation.controlResults.nonconformityRaised');
    case 'observation_raised':
      return t('internalAuditValidation.controlResults.observationRaised');
    default:
      return t('internalAuditValidation.controlResults.notSampled');
  }
}

export function findingTypeLabel(t: InternalAuditTranslator, type: IsmsAuditFindingType): string {
  switch (type) {
    case 'nc_major':
      return t('internalAuditValidation.findingTypes.ncMajor');
    case 'nc_minor':
      return t('internalAuditValidation.findingTypes.ncMinor');
    case 'ofi':
      return t('internalAuditValidation.findingTypes.ofi');
    default:
      return t('internalAuditValidation.findingTypes.observation');
  }
}

/** Plain-English explanation of each finding type (the ticket's tooltip copy). */
export function findingTypeDescription(
  t: InternalAuditTranslator,
  type: IsmsAuditFindingType,
): string {
  switch (type) {
    case 'nc_major':
      return t('internalAuditValidation.findingTypeDescriptions.ncMajor');
    case 'nc_minor':
      return t('internalAuditValidation.findingTypeDescriptions.ncMinor');
    case 'ofi':
      return t('internalAuditValidation.findingTypeDescriptions.ofi');
    default:
      return t('internalAuditValidation.findingTypeDescriptions.observation');
  }
}

export function findingStatusLabel(
  t: InternalAuditTranslator,
  status: IsmsAuditFindingStatus,
): string {
  switch (status) {
    case 'open':
      return t('internalAuditValidation.findingStatuses.open');
    case 'in_progress':
      return t('internalAuditValidation.findingStatuses.inProgress');
    default:
      return t('internalAuditValidation.findingStatuses.closed');
  }
}

export function findingDescriptionPlaceholder(t: InternalAuditTranslator): string {
  return t('internalAuditValidation.findingDescriptionPlaceholder');
}

/**
 * Clause-9.2 readiness check — client mirror of the server submit gate
 * (auditValidationMessages in apps/api documents/internal-audit.ts).
 */
export function auditValidationMessages(
  t: InternalAuditTranslator,
  { audits }: { audits: Array<Pick<IsmsAudit, 'reference' | 'status' | 'conclusionVerdict'>> },
): string[] {
  if (audits.length === 0) {
    return [t('internalAuditValidation.noAuditsRecorded')];
  }
  return audits
    .filter((audit) => audit.status === 'complete' && !audit.conclusionVerdict)
    .map((audit) =>
      t('internalAuditValidation.missingVerdict', { reference: audit.reference }),
    );
}
