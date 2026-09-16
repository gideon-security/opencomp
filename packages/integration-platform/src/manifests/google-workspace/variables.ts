import type { CheckVariable } from '../../types';
import type { GoogleWorkspaceOrgUnitsResponse } from './types';

/**
 * Target organizational units for checks and employee sync.
 * Allows filtering to specific OUs instead of entire domain.
 */
export const targetOrgUnitsVariable: CheckVariable = {
  id: 'target_org_units',
  label: 'Organizational Units',
  helpText:
    'Select which organizational units to include in checks and employee sync (leave empty for all)',
  type: 'multi-select',
  required: false,
  fetchOptions: async (ctx) => {
    try {
      const response = await ctx.fetch<GoogleWorkspaceOrgUnitsResponse>(
        '/admin/directory/v1/customer/my_customer/orgunits?type=all',
      );

      const rootOption = { value: '/', label: '/ (Root)' };

      if (!response.organizationUnits) {
        return [rootOption];
      }

      return [
        rootOption,
        ...response.organizationUnits.map((ou) => ({
          value: ou.orgUnitPath,
          label: `${ou.orgUnitPath} (${ou.name})`,
        })),
      ];
    } catch {
      return [{ value: '/', label: '/ (Root)' }];
    }
  },
};

/**
 * Whether to include suspended users in checks
 */
export const includeSuspendedVariable: CheckVariable = {
  id: 'include_suspended',
  label: 'Include Suspended Users',
  helpText: 'Include suspended users in security checks',
  type: 'select',
  required: false,
  default: 'false',
  options: [
    { value: 'false', label: 'No - Only active users' },
    { value: 'true', label: 'Yes - Include suspended users' },
  ],
};

/**
 * Employee sync filtering mode
 * Controls whether sync should include all users, exclude selected inboxes,
 * or include only selected inboxes.
 */
export const syncUserFilterModeVariable: CheckVariable = {
  id: 'sync_user_filter_mode',
  label: 'User Filter Mode',
  helpText: 'Choose which Google Workspace users to include in sync and security checks',
  type: 'select',
  required: false,
  default: 'all',
  options: [
    { value: 'all', label: 'Include all users' },
    { value: 'exclude', label: 'Exclude matching users' },
    { value: 'include', label: 'Include only matching users' },
  ],
};

/**
 * Comma/newline-separated list of inbox emails to exclude from employee sync.
 */
export const syncExcludedEmailsVariable: CheckVariable = {
  id: 'sync_excluded_emails',
  label: 'Exclude from Sync & Checks',
  helpText:
    'Add full emails, domains (@company.com or company.com), or partial text. Press Enter after each value. Matching users are excluded from both employee sync and security checks (2FA, Access Review).',
  type: 'multi-select',
  required: false,
  placeholder: 'Type a value and press Enter',
};

/**
 * Comma/newline-separated list of inbox emails to include in employee sync.
 */
export const syncIncludedEmailsVariable: CheckVariable = {
  id: 'sync_included_emails',
  label: 'Include in Sync & Checks',
  helpText:
    'Add full emails, domains (@company.com or company.com), or partial text. Press Enter after each value. Only matching users are included in sync and security checks. If empty, all users are included.',
  type: 'multi-select',
  required: false,
  placeholder: 'Type a value and press Enter',
};
