'use client';

import { api } from '@/lib/api-client';
import { useTranslations } from 'next-intl';
import { Badge, Button, Section, Stack, Text } from '@trycompai/design-system';
import { useState } from 'react';
import { toast } from 'sonner';
import useSWR from 'swr';
import {
  BillingPreferencesAdminForm,
  CreditGrantForm,
  PlanChangeForm,
  type CreditFormValues,
  type PlanFormValues,
  type PreferenceFormValues,
} from './AdminBillingForms';
import { CreditBalanceRows, InvoiceRows, SubscriptionRows } from './AdminBillingTables';
import type {
  AdminBillingInvoice,
  AdminBillingStatus,
  AdminBillingSubscription,
} from './AdminBillingTypes';

class BillingLoadError extends Error {}

const fetcher = async ([url, currentOrgId]: [string, string]) => {
  const response = await api.get<AdminBillingStatus>(url, currentOrgId);
  if (response.error || !response.data) {
    throw new BillingLoadError(response.error ?? undefined);
  }
  return response.data;
};

export function AdminBillingTab({ orgId, currentOrgId }: { orgId: string; currentOrgId: string }) {
  const t = useTranslations('admin');
  const endpoint = `/v1/admin/organizations/${orgId}/billing`;
  const { data, error, isLoading, mutate } = useSWR<AdminBillingStatus>(
    [endpoint, currentOrgId],
    fetcher,
    { revalidateOnFocus: false },
  );
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  if (error) {
    const message =
      error instanceof BillingLoadError && error.message
        ? error.message
        : t('organizations.billingTab.loadError');
    return <Text variant="muted">{message}</Text>;
  }
  if (isLoading || !data) {
    return <Text variant="muted">{t('organizations.billingTab.loading')}</Text>;
  }

  const handleRefresh = () => mutate();

  const handlePlanSubmit = async (values: PlanFormValues) => {
    setLoadingAction('plan');
    const response = await api.post<AdminBillingStatus | { url: string }>(
      `${endpoint}/subscriptions`,
      {
        ...values,
        returnUrl: `${window.location.origin}/${currentOrgId}/admin/organizations/${orgId}`,
      },
      currentOrgId,
    );
    setLoadingAction(null);
    if (response.error) {
      toast.error(response.error);
      return;
    }
    if (response.data && 'url' in response.data) {
      window.open(response.data.url, '_blank', 'noopener,noreferrer');
      toast.success(t('organizations.billingTab.checkoutOpened'));
      return;
    }
    toast.success(t('organizations.billingTab.subscriptionUpdated'));
    await mutate(response.data, { revalidate: true });
  };

  const handleCreditSubmit = async (values: CreditFormValues) => {
    setLoadingAction('credits');
    const response = await api.post<AdminBillingStatus>(
      `${endpoint}/credits`,
      values,
      currentOrgId,
    );
    setLoadingAction(null);
    if (response.error) {
      toast.error(response.error);
      return;
    }
    toast.success(t('organizations.billingTab.creditsGranted'));
    await mutate(response.data, { revalidate: false });
  };

  const handlePreferencesSubmit = async (values: PreferenceFormValues) => {
    setLoadingAction('preferences');
    const response = await api.put<AdminBillingStatus>(
      `${endpoint}/preferences`,
      values,
      currentOrgId,
    );
    setLoadingAction(null);
    if (response.error) {
      toast.error(response.error);
      return;
    }
    toast.success(t('organizations.billingTab.preferencesUpdated'));
    await mutate(response.data, { revalidate: false });
  };

  const handleCancel = async (subscription: AdminBillingSubscription, immediate: boolean) => {
    const note = window.prompt(t('organizations.billingTab.prompts.cancelReason'));
    if (!note) return;
    const confirm = immediate
      ? window.prompt(t('organizations.billingTab.prompts.cancelConfirm'))
      : undefined;
    setLoadingAction(subscription.id);
    const response = await api.post<AdminBillingStatus>(
      `${endpoint}/subscriptions/${subscription.id}/cancel`,
      {
        mode: immediate ? 'immediate' : 'period_end',
        note,
        confirm,
      },
      currentOrgId,
    );
    setLoadingAction(null);
    if (response.error) {
      toast.error(response.error);
      return;
    }
    toast.success(t('organizations.billingTab.cancellationUpdated'));
    await mutate(response.data, { revalidate: false });
  };

  const handleResume = async (subscription: AdminBillingSubscription) => {
    const note = window.prompt(t('organizations.billingTab.prompts.resumeReason'));
    if (!note) return;
    setLoadingAction(subscription.id);
    const response = await api.post<AdminBillingStatus>(
      `${endpoint}/subscriptions/${subscription.id}/resume`,
      { note },
      currentOrgId,
    );
    setLoadingAction(null);
    if (response.error) {
      toast.error(response.error);
      return;
    }
    toast.success(t('organizations.billingTab.resumed'));
    await mutate(response.data, { revalidate: false });
  };

  const handleRetryLink = async (invoice: AdminBillingInvoice) => {
    setLoadingAction(invoice.id);
    const response = await api.post<{ hostedInvoiceUrl: string | null }>(
      `${endpoint}/invoices/${invoice.id}/retry-link`,
      { note: 'Customer success opened recovery link' },
      currentOrgId,
    );
    setLoadingAction(null);
    if (response.error) {
      toast.error(response.error);
      return;
    }
    if (response.data?.hostedInvoiceUrl) {
      window.open(response.data.hostedInvoiceUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    toast.error(t('organizations.billingTab.noRecoveryLink'));
  };

  return (
    <Stack gap="lg">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label={t('organizations.billingTab.stripeCustomer')}
          value={data.stripeCustomerId ?? t('organizations.billingTab.none')}
        />
        <SummaryCard
          label={t('organizations.billingTab.paymentMethod')}
          value={
            data.hasPaymentMethod
              ? t('organizations.billingTab.saved')
              : t('organizations.billingTab.missing')
          }
        />
        <SummaryCard
          label={t('organizations.billingTab.failedInvoices')}
          value={String(data.failedInvoices.length)}
        />
      </div>
      <Section
        title={t('organizations.billingTab.subscriptions')}
        actions={
          <Button size="sm" variant="outline" onClick={handleRefresh}>
            {t('organizations.billingTab.refresh')}
          </Button>
        }
      >
        <Stack gap="4">
          <PlanChangeForm
            status={data}
            loading={loadingAction === 'plan'}
            onSubmit={handlePlanSubmit}
          />
          <SubscriptionRows
            subscriptions={data.subscriptions}
            onCancel={handleCancel}
            onResume={handleResume}
            loadingId={loadingAction}
          />
        </Stack>
      </Section>
      <Section title={t('organizations.billingTab.freeCredits')}>
        <Stack gap="4">
          <CreditBalanceRows balances={data.creditBalances} />
          <CreditGrantForm loading={loadingAction === 'credits'} onSubmit={handleCreditSubmit} />
        </Stack>
      </Section>
      <Section title={t('organizations.billingTab.billingDetails')}>
        <BillingPreferencesAdminForm
          status={data}
          loading={loadingAction === 'preferences'}
          onSubmit={handlePreferencesSubmit}
        />
      </Section>
      <Section title={t('organizations.billingTab.invoicesAndRecovery')}>
        <InvoiceRows
          invoices={data.invoices}
          onRetryLink={handleRetryLink}
          loadingId={loadingAction}
        />
      </Section>
      <Section title={t('organizations.billingTab.auditHistory')}>
        <div className="grid gap-2">
          {data.auditEvents.map((event) => (
            <div key={event.id} className="flex items-center justify-between rounded-lg border p-3">
              <Text size="sm">{event.eventType}</Text>
              <Badge variant="outline">{new Date(event.createdAt).toLocaleString()}</Badge>
            </div>
          ))}
          {data.auditEvents.length === 0 && (
            <Text variant="muted">{t('organizations.billingTab.noAuditEvents')}</Text>
          )}
        </div>
      </Section>
    </Stack>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <Text size="xs" variant="muted">
        {label}
      </Text>
      <div className="mt-2 break-all text-lg font-semibold">{value}</div>
    </div>
  );
}
