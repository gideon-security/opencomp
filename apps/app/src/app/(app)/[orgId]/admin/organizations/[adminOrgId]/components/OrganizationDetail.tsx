'use client';

import { RecentAuditLogs } from '@/components/RecentAuditLogs';
import { apiClient } from '@/lib/api-client';
import { useAdminAuditLogs } from '../hooks/use-admin-audit-logs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Section,
  Stack,
  Switch,
  Text,
} from '@trycompai/design-system';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

interface AdminOrgDetail {
  id: string;
  name: string;
  logo: string | null;
  createdAt: string;
  onboardingCompleted: boolean;
  members: { id: string }[];
  backgroundCheckStepEnabled: boolean;
  isInternal: boolean;
}

export function OrganizationDetail({
  org,
  currentOrgId,
  hasAccess,
}: {
  org: AdminOrgDetail;
  currentOrgId: string;
  hasAccess: boolean;
}) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [bgCheckEnabled, setBgCheckEnabled] = useState(org.backgroundCheckStepEnabled);
  const [savingBgCheck, setSavingBgCheck] = useState(false);
  const [isInternal, setIsInternal] = useState(org.isInternal);
  const [savingInternal, setSavingInternal] = useState(false);
  const [pendingInternal, setPendingInternal] = useState<boolean | null>(null);

  const handleToggleBgCheck = async (next: boolean) => {
    const previous = bgCheckEnabled;
    setBgCheckEnabled(next);
    setSavingBgCheck(true);

    const res = await apiClient.patch(`/v1/admin/organizations/${org.id}`, {
      backgroundCheckStepEnabled: next,
    });

    setSavingBgCheck(false);

    if (res.error) {
      setBgCheckEnabled(previous);
      toast.error(t('organizations.detail.bgCheckUpdateError'));
      return;
    }

    toast.success(
      next
        ? t('organizations.detail.bgCheckEnabledToast')
        : t('organizations.detail.bgCheckDisabledToast'),
    );
  };

  // Toggling `isInternal` changes org-wide membership semantics, so confirm
  // first (the switch flips only after the admin confirms).
  const handleRequestToggleInternal = (next: boolean) => {
    setPendingInternal(next);
  };

  const handleConfirmToggleInternal = async () => {
    if (pendingInternal === null) return;
    const next = pendingInternal;
    const previous = isInternal;
    setPendingInternal(null);
    setIsInternal(next);
    setSavingInternal(true);

    const res = await apiClient.patch(`/v1/admin/organizations/${org.id}`, {
      isInternal: next,
    });

    setSavingInternal(false);

    if (res.error) {
      setIsInternal(previous);
      toast.error(t('organizations.detail.internalUpdateError'));
      return;
    }

    // If this is the org the admin is currently browsing, refresh the server
    // layout so OrgInternalProvider (and consumers like the assignee picker)
    // reflect the new flag without a full page reload.
    if (org.id === currentOrgId) {
      router.refresh();
    }

    toast.success(
      next
        ? t('organizations.detail.internalEnabledToast')
        : t('organizations.detail.internalDisabledToast'),
    );
  };

  const { logs, total, hasMore, loadMore, isLoadingMore, isLoading } =
    useAdminAuditLogs(org.id);

  return (
    <Stack gap="lg">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <InfoCard
          label={t('organizations.detail.status')}
          value={hasAccess ? t('organizations.detail.active') : t('organizations.detail.inactive')}
          variant={hasAccess ? 'default' : 'destructive'}
        />
        <InfoCard
          label={t('organizations.detail.members')}
          value={String(org.members.length)}
        />
        <InfoCard
          label={t('organizations.detail.created')}
          value={new Date(org.createdAt).toLocaleDateString()}
        />
        <InfoCard
          label={t('organizations.detail.onboarding')}
          value={
            org.onboardingCompleted
              ? t('organizations.detail.completed')
              : t('organizations.detail.pending')
          }
        />
      </div>

      <Section title={t('organizations.detail.complianceSettings')}>
        <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
          <div className="flex-1">
            <Text weight="medium">{t('organizations.detail.requireBackgroundChecks')}</Text>
            <Text size="sm" variant="muted">
              {t('organizations.detail.backgroundChecksDescription')}
            </Text>
          </div>
          <Switch
            checked={bgCheckEnabled}
            disabled={savingBgCheck}
            onCheckedChange={handleToggleBgCheck}
            aria-label={t('organizations.detail.requireBackgroundChecks')}
          />
        </div>
      </Section>

      <Section title={t('organizations.detail.platformSettings')}>
        <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
          <div className="flex-1">
            <Text weight="medium">{t('organizations.detail.internalOrganization')}</Text>
            <Text size="sm" variant="muted">
              {t('organizations.detail.internalOrganizationDescription')}
            </Text>
          </div>
          <Switch
            checked={isInternal}
            disabled={savingInternal}
            onCheckedChange={handleRequestToggleInternal}
            aria-label={t('organizations.detail.internalOrganization')}
          />
        </div>
      </Section>

      {isLoading ? (
        <Section title={t('organizations.detail.recentActivity')}>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-5 w-5 animate-pulse rounded-full bg-muted" />
                <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </Section>
      ) : (
        <RecentAuditLogs
          logs={logs}
          title={t('organizations.detail.recentActivity')}
          total={total}
          hasMore={hasMore}
          onLoadMore={loadMore}
          isLoadingMore={isLoadingMore}
        />
      )}

      <AlertDialog
        open={pendingInternal !== null}
        onOpenChange={(open) => {
          if (!open) setPendingInternal(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingInternal
                ? t('organizations.detail.markInternalTitle')
                : t('organizations.detail.removeInternalTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingInternal
                ? t('organizations.detail.markInternalDescription')
                : t('organizations.detail.removeInternalDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('organizations.detail.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmToggleInternal}>
              {pendingInternal
                ? t('organizations.detail.markInternalAction')
                : t('organizations.detail.removeInternalAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Stack>
  );
}

function InfoCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant?: 'default' | 'destructive';
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <Text size="xs" variant="muted">
        {label}
      </Text>
      <div className="mt-1">
        {variant ? (
          <Badge variant={variant}>{value}</Badge>
        ) : (
          <Text size="lg" weight="semibold">
            {value}
          </Text>
        )}
      </div>
    </div>
  );
}
