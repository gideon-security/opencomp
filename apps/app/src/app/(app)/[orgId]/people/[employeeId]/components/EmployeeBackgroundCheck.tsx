'use client';

import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import type { Member, User } from '@db';
import { Stack } from '@trycompai/design-system';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { BackgroundCheckAdminActions } from './BackgroundCheckAdminActions';
import type { AttachFormValues } from './BackgroundCheckAttachForm';
import type { ExemptFormValues } from './BackgroundCheckExemptForm';
import {
  BackgroundCheckDisabledNotice,
  BackgroundCheckExemptToggle,
  BackgroundCheckNotice,
} from './BackgroundCheckNotices';
import type { OrderFormValues } from './BackgroundCheckOrderForm';
import { BackgroundCheckStatusView } from './BackgroundCheckStatusView';
import type { BackgroundCheckBillingStatus, BackgroundCheckRecord } from './backgroundCheckTypes';
import {
  buildAttachNotes,
  computeCredits,
  fileToBase64,
  isValidEmail,
} from './backgroundCheckUtils';
import { BackgroundCheckV1Page, type SelectedPath } from './BackgroundCheckV1Page';
import {
  getBackgroundChecksRemaining,
  useBackgroundCheckBillingStatus,
  useBackgroundCheckRecord,
} from './useEmployeeBackgroundCheckData';

interface EmployeeBackgroundCheckProps {
  employee: Member & { user: User };
  organizationId: string;
  initialBackgroundCheck: BackgroundCheckRecord | null;
  initialBillingStatus: BackgroundCheckBillingStatus;
  backgroundCheckStepEnabled: boolean;
  memberBackgroundCheckExempt: boolean;
  onMemberBackgroundCheckExemptChange?: (next: boolean) => void;
}

export function EmployeeBackgroundCheck({
  employee,
  organizationId,
  initialBackgroundCheck,
  initialBillingStatus,
  backgroundCheckStepEnabled,
  memberBackgroundCheckExempt,
  onMemberBackgroundCheckExemptChange,
}: EmployeeBackgroundCheckProps) {
  const t = useTranslations('people');
  const [selectedPath, setSelectedPath] = useState<SelectedPath>('order');
  const [orderValues, setOrderValues] = useState<OrderFormValues>({
    employeeName: employee.user.name ?? '',
    employeeEmail: '',
    requesterNotes: '',
  });
  const [orderErrors, setOrderErrors] = useState<Partial<Record<keyof OrderFormValues, string>>>(
    {},
  );
  const [attachValues, setAttachValues] = useState<AttachFormValues>({
    vendor: 'checkr',
    reportDate: '',
    file: null,
  });
  const [exemptValues, setExemptValues] = useState<ExemptFormValues>({
    reason: '',
    justification: '',
  });

  const [isOrderSubmitting, setIsOrderSubmitting] = useState(false);
  const [isAttachSubmitting, setIsAttachSubmitting] = useState(false);
  const [isExemptSubmitting, setIsExemptSubmitting] = useState(false);

  const [internalExempt, setInternalExempt] = useState(memberBackgroundCheckExempt);
  const [lastSyncedExempt, setLastSyncedExempt] = useState(memberBackgroundCheckExempt);
  if (memberBackgroundCheckExempt !== lastSyncedExempt) {
    setLastSyncedExempt(memberBackgroundCheckExempt);
    setInternalExempt(memberBackgroundCheckExempt);
  }
  const isExemptControlled = onMemberBackgroundCheckExemptChange !== undefined;
  const exempt = isExemptControlled ? memberBackgroundCheckExempt : internalExempt;
  const setExempt = (next: boolean) => {
    if (isExemptControlled) {
      onMemberBackgroundCheckExemptChange(next);
    } else {
      setInternalExempt(next);
    }
  };
  const [savingExempt, setSavingExempt] = useState(false);
  const { hasPermission } = usePermissions();

  const { data: backgroundCheck, mutate: mutateBackgroundCheck } = useBackgroundCheckRecord({
    enabled: backgroundCheckStepEnabled,
    employeeId: employee.id,
    initialBackgroundCheck,
    organizationId,
  });
  const { data: billingStatus } = useBackgroundCheckBillingStatus({
    enabled: backgroundCheckStepEnabled,
    initialBillingStatus,
    organizationId,
  });

  const canRequest = hasPermission('member', 'update');
  const canManageBilling = hasPermission('organization', 'update');
  const remaining = getBackgroundChecksRemaining({ billingStatus });
  const { creditsUsed, creditsIncluded } = computeCredits(billingStatus);
  const hasAllowance = remaining !== null && remaining > 0;
  const planHref = `/${organizationId}/settings/billing/add-ons/background-checks`;

  const handleOrderSubmit = async () => {
    const errors: Partial<Record<keyof OrderFormValues, string>> = {};
    if (!orderValues.employeeName.trim()) {
      errors.employeeName = t('backgroundCheck.main.nameRequired');
    }
    if (!isValidEmail(orderValues.employeeEmail)) {
      errors.employeeEmail = t('backgroundCheck.main.invalidPersonalEmail');
    }
    setOrderErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsOrderSubmitting(true);
    const response = await apiClient.post<BackgroundCheckRecord>(
      `/v1/people/${employee.id}/background-check`,
      {
        employeeName: orderValues.employeeName.trim(),
        employeeEmail: orderValues.employeeEmail.trim(),
        requesterNotes: orderValues.requesterNotes?.trim() || undefined,
      },
      organizationId,
    );
    setIsOrderSubmitting(false);

    if (response.error || !response.data) {
      toast.error(t('backgroundCheck.main.requestFailed'));
      return;
    }

    toast.success(t('backgroundCheck.main.inviteSentTo', { email: orderValues.employeeEmail }));
    await mutateBackgroundCheck(response.data, { revalidate: false });
  };

  const handleAttachSubmit = async () => {
    if (!attachValues.file) return;

    setIsAttachSubmitting(true);
    try {
      const fileData = await fileToBase64(attachValues.file);
      const response = await apiClient.post<BackgroundCheckRecord>(
        `/v1/people/${employee.id}/background-check/custom`,
        {
          employeeName: employee.user.name ?? employee.user.email,
          employeeEmail: employee.user.email,
          fileName: attachValues.file.name,
          fileType: attachValues.file.type || 'application/pdf',
          fileData,
          requesterNotes: buildAttachNotes(attachValues),
        },
        organizationId,
      );

      if (response.error || !response.data) {
        toast.error(t('backgroundCheck.main.uploadFailed'));
        return;
      }

      toast.success(t('backgroundCheck.main.customAttached'));
      await mutateBackgroundCheck(response.data, { revalidate: false });
    } catch {
      toast.error(t('backgroundCheck.main.uploadFailed'));
    } finally {
      setIsAttachSubmitting(false);
    }
  };

  const handleExemptSubmit = async () => {
    setIsExemptSubmitting(true);
    const res = await apiClient.patch(
      `/v1/people/${employee.id}`,
      {
        backgroundCheckExempt: true,
        backgroundCheckExemptReason: exemptValues.reason,
        backgroundCheckExemptJustification: exemptValues.justification,
      },
      organizationId,
    );
    setIsExemptSubmitting(false);

    if (res.error) {
      toast.error(t('backgroundCheck.main.confirmExemptFailed'));
      return;
    }

    setExempt(true);
    toast.success(
      t('backgroundCheck.main.exemptSuccess', {
        name: employee.user.name ?? t('backgroundCheck.main.defaultEmployeeName'),
      }),
    );
  };

  const handleToggleExempt = async (next: boolean) => {
    const previous = exempt;
    setExempt(next);
    setSavingExempt(true);

    const res = await apiClient.patch(
      `/v1/people/${employee.id}`,
      { backgroundCheckExempt: next },
      organizationId,
    );

    setSavingExempt(false);

    if (res.error) {
      setExempt(previous);
      toast.error(t('backgroundCheck.main.updateExemptFailed'));
      return;
    }

    toast.success(
      next
        ? t('backgroundCheck.main.toggleExemptOn')
        : t('backgroundCheck.main.toggleExemptOff'),
    );
  };

  if (!backgroundCheckStepEnabled) {
    return <BackgroundCheckDisabledNotice />;
  }

  if (exempt) {
    return (
      <Stack gap="md">
        <BackgroundCheckExemptToggle
          exempt={exempt}
          saving={savingExempt}
          canUpdate={canRequest}
          onToggle={handleToggleExempt}
        />
        <BackgroundCheckNotice
          title={t('backgroundCheck.main.exemptNoticeTitle')}
          body={t('backgroundCheck.main.exemptNoticeBody')}
        />
      </Stack>
    );
  }

  if (backgroundCheck) {
    return (
      <Stack gap="md">
        <BackgroundCheckExemptToggle
          exempt={exempt}
          saving={savingExempt}
          canUpdate={canRequest}
          onToggle={handleToggleExempt}
        />
        <BackgroundCheckStatusView
          backgroundCheck={backgroundCheck}
          memberId={employee.id}
          organizationId={organizationId}
          actions={
            <BackgroundCheckAdminActions
              backgroundCheck={backgroundCheck}
              memberId={employee.id}
              organizationId={organizationId}
              onChange={(next) => {
                mutateBackgroundCheck(next, { revalidate: false });
              }}
            />
          }
        />
      </Stack>
    );
  }

  return (
    <BackgroundCheckV1Page
      selectedPath={selectedPath}
      onSelectedPathChange={setSelectedPath}
      creditsUsed={creditsUsed}
      creditsIncluded={creditsIncluded}
      planHref={planHref}
      canManageBilling={canManageBilling}
      orderValues={orderValues}
      orderErrors={orderErrors}
      onOrderChange={setOrderValues}
      onOrderSubmit={handleOrderSubmit}
      isOrderSubmitting={isOrderSubmitting}
      hasAllowance={hasAllowance}
      attachValues={attachValues}
      onAttachChange={setAttachValues}
      onAttachSubmit={handleAttachSubmit}
      isAttachSubmitting={isAttachSubmitting}
      exemptValues={exemptValues}
      onExemptChange={setExemptValues}
      onExemptSubmit={handleExemptSubmit}
      isExemptSubmitting={isExemptSubmitting}
      canRequest={canRequest}
    />
  );
}
