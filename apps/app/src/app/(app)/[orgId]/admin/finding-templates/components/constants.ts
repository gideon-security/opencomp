import type { useTranslations } from 'next-intl';

/**
 * Finding template categories. The values must match the strings stored in
 * the `FindingTemplate.category` column (and previously managed by the
 * cx-dashboard admin UI): evidence_issue, further_evidence, task_specific,
 * na_incorrect.
 *
 * Display labels are resolved in-component via next-intl
 * (`admin.findingTemplates.categories.*`).
 */
export const FINDING_TEMPLATE_CATEGORIES = [
  'evidence_issue',
  'further_evidence',
  'task_specific',
  'na_incorrect',
] as const;

type AdminTranslator = ReturnType<typeof useTranslations<'admin'>>;

export function findingTemplateCategoryLabel(t: AdminTranslator, value: string) {
  switch (value) {
    case 'evidence_issue':
      return t('findingTemplates.categories.evidenceIssue');
    case 'further_evidence':
      return t('findingTemplates.categories.furtherEvidence');
    case 'task_specific':
      return t('findingTemplates.categories.taskSpecific');
    case 'na_incorrect':
      return t('findingTemplates.categories.naIncorrect');
    default:
      return value;
  }
}
