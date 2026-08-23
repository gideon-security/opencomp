import { useTranslations } from 'next-intl';

type IsmsTranslator = ReturnType<typeof useTranslations<'isms'>>;

export function formFieldLabel(t: IsmsTranslator, key: string): string {
  switch (key) {
    case 'meeting':
      return t('formFields.meeting');
    case 'board-meeting':
      return t('formFields.boardMeeting');
    case 'it-leadership-meeting':
      return t('formFields.itLeadershipMeeting');
    case 'risk-committee-meeting':
      return t('formFields.riskCommitteeMeeting');
    case 'access-request':
      return t('formFields.accessRequest');
    case 'whistleblower-report':
      return t('formFields.whistleblowerReport');
    case 'penetration-test':
      return t('formFields.penetrationTest');
    case 'rbac-matrix':
      return t('formFields.rbacMatrix');
    case 'infrastructure-inventory':
      return t('formFields.infrastructureInventory');
    case 'employee-performance-evaluation':
      return t('formFields.employeePerformanceEvaluation');
    case 'network-diagram':
      return t('formFields.networkDiagram');
    case 'tabletop-exercise':
      return t('formFields.tabletopExercise');
    default:
      return key;
  }
}
