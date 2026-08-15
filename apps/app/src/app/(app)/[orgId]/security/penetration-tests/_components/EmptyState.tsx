'use client';

import { Button } from '@trycompai/design-system';
import { Link, Rocket, Settings } from '@trycompai/design-system/icons';
import { useTranslations } from 'next-intl';

interface EmptyStateProps {
  onCreateClick: () => void;
  /** Subscription allowance balance — when 0 the CTA routes to plans. */
  balance?: number;
  planRequired?: boolean;
  quotaLabel?: 'Plan';
}

export function EmptyState({
  onCreateClick,
  balance,
  planRequired,
  quotaLabel = 'Plan',
}: EmptyStateProps) {
  const t = useTranslations('security');
  const canCreate = balance === undefined ? true : balance > 0;
  const tagline = planRequired
    ? t('penTest.emptyState.taglinePlanRequired')
    : t('penTest.emptyState.taglineDefault');
  const STEPS = [
    {
      title: t('penTest.emptyState.step1Title'),
      description: t('penTest.emptyState.step1Description'),
      Icon: Link,
    },
    {
      title: t('penTest.emptyState.step2Title'),
      description: t('penTest.emptyState.step2Description'),
      Icon: Settings,
    },
    {
      title: t('penTest.emptyState.step3Title'),
      description: t('penTest.emptyState.step3Description'),
      Icon: Rocket,
    },
  ];
  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col items-start justify-center gap-6 px-4 py-10 md:px-8 md:py-12">
      <div>
        <div className="mb-3 inline-flex items-center gap-2">
          <h1 className="text-[26px] font-medium tracking-[-0.02em]">
            {t('penTest.emptyState.title')}
          </h1>
          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {t('penTest.emptyState.newBadge')}
          </span>
        </div>
        <p className="max-w-xl text-sm text-muted-foreground">{tagline}</p>
      </div>

      <Button onClick={onCreateClick}>
        {canCreate
          ? t('penTest.emptyState.newScanButton', { quota: quotaLabel })
          : t('penTest.emptyState.viewPlans')}
      </Button>

      <div className="w-full rounded-[var(--radius)] border border-border bg-background">
        <div className="border-b border-border px-5 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {t('penTest.emptyState.howItWorks')}
          </p>
        </div>
        <ol className="divide-y divide-border">
          {STEPS.map((step, i) => {
            const { Icon } = step;
            return (
              <li key={step.title} className="flex items-start gap-4 px-5 py-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-mono text-[11px] text-muted-foreground">
                  {i + 1}
                </span>
                <Icon className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{step.title}</div>
                  <div className="text-sm text-muted-foreground">{step.description}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
