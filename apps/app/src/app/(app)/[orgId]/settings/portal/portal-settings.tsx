'use client';

import { useOrganizationMutations } from '@/hooks/use-organization-mutations';
import { usePermissions } from '@/hooks/use-permissions';
import { SettingGroup, SettingRow, Switch } from '@trycompai/design-system';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

interface PortalSettingsProps {
  deviceAgentStepEnabled: boolean;
  securityTrainingStepEnabled: boolean;
  whistleblowerReportEnabled: boolean;
  accessRequestFormEnabled: boolean;
}

export function PortalSettings({
  deviceAgentStepEnabled,
  securityTrainingStepEnabled,
  whistleblowerReportEnabled,
  accessRequestFormEnabled,
}: PortalSettingsProps) {
  const { hasPermission } = usePermissions();
  const { updateOrganization } = useOrganizationMutations();
  const t = useTranslations('settings');
  const [updatingField, setUpdatingField] = useState<string | null>(null);

  const handleToggle = async (
    field: string,
    value: boolean,
    successMessage: string,
    errorMessage: string,
  ) => {
    setUpdatingField(field);
    try {
      await updateOrganization({ [field]: value });
      toast.success(successMessage);
    } catch {
      toast.error(errorMessage);
    } finally {
      setUpdatingField(null);
    }
  };

  return (
    <SettingGroup>
      <SettingRow
        size="lg"
        label={t('portal.showDeviceAgentStep')}
        description={t('portal.showDeviceAgentStepDescription')}
      >
        <Switch
          checked={deviceAgentStepEnabled}
          onCheckedChange={(checked) => {
            handleToggle(
              'deviceAgentStepEnabled',
              checked,
              t('portal.deviceAgentStepUpdated'),
              t('portal.deviceAgentStepError'),
            );
          }}
          disabled={!hasPermission('organization', 'update') || updatingField === 'deviceAgentStepEnabled'}
        />
      </SettingRow>
      <SettingRow
        size="lg"
        label={t('portal.showSecurityTrainingStep')}
        description={t('portal.showSecurityTrainingStepDescription')}
      >
        <Switch
          checked={securityTrainingStepEnabled}
          onCheckedChange={(checked) => {
            handleToggle(
              'securityTrainingStepEnabled',
              checked,
              t('portal.securityTrainingStepUpdated'),
              t('portal.securityTrainingStepError'),
            );
          }}
          disabled={!hasPermission('organization', 'update') || updatingField === 'securityTrainingStepEnabled'}
        />
      </SettingRow>
      <SettingRow
        size="lg"
        label={t('portal.showWhistleblowerReportForm')}
        description={t('portal.showWhistleblowerReportFormDescription')}
      >
        <Switch
          checked={whistleblowerReportEnabled}
          onCheckedChange={(checked) => {
            handleToggle(
              'whistleblowerReportEnabled',
              checked,
              t('portal.whistleblowerReportUpdated'),
              t('portal.whistleblowerReportError'),
            );
          }}
          disabled={!hasPermission('organization', 'update') || updatingField === 'whistleblowerReportEnabled'}
        />
      </SettingRow>
      <SettingRow
        size="lg"
        label={t('portal.showAccessRequestForm')}
        description={t('portal.showAccessRequestFormDescription')}
      >
        <Switch
          checked={accessRequestFormEnabled}
          onCheckedChange={(checked) => {
            handleToggle(
              'accessRequestFormEnabled',
              checked,
              t('portal.accessRequestUpdated'),
              t('portal.accessRequestError'),
            );
          }}
          disabled={!hasPermission('organization', 'update') || updatingField === 'accessRequestFormEnabled'}
        />
      </SettingRow>
    </SettingGroup>
  );
}
