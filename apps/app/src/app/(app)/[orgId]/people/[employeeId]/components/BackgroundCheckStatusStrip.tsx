'use client';

import { Badge, Text } from '@trycompai/design-system';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { BackgroundCheckStatus } from './backgroundCheckTypes';

type StripStatus = BackgroundCheckStatus | 'not_started' | 'exempt';

type Translator = ReturnType<typeof useTranslations<'people'>>;

interface StatusStripProps {
  status: StripStatus;
  creditsUsed: number;
  creditsIncluded: number;
  planHref: string;
  canManageBilling: boolean;
}

const stripCopy = (
  status: StripStatus,
  t: Translator,
): { label: string; sentence: string } => {
  switch (status) {
    case 'not_started':
      return {
        label: t('backgroundCheck.strip.notStarted.label'),
        sentence: t('backgroundCheck.strip.notStarted.sentence'),
      };
    case 'invited':
      return {
        label: t('backgroundCheck.strip.invited.label'),
        sentence: t('backgroundCheck.strip.invited.sentence'),
      };
    case 'in_progress':
      return {
        label: t('backgroundCheck.strip.inProgress.label'),
        sentence: t('backgroundCheck.strip.inProgress.sentence'),
      };
    case 'in_review':
      return {
        label: t('backgroundCheck.strip.inReview.label'),
        sentence: t('backgroundCheck.strip.inReview.sentence'),
      };
    case 'completed':
      return {
        label: t('backgroundCheck.strip.completed.label'),
        sentence: t('backgroundCheck.strip.completed.sentence'),
      };
    case 'completed_with_flags':
      return {
        label: t('backgroundCheck.strip.completedWithFlags.label'),
        sentence: t('backgroundCheck.strip.completedWithFlags.sentence'),
      };
    case 'failed':
      return {
        label: t('backgroundCheck.strip.failed.label'),
        sentence: t('backgroundCheck.strip.failed.sentence'),
      };
    case 'cancelled':
      return {
        label: t('backgroundCheck.strip.cancelled.label'),
        sentence: t('backgroundCheck.strip.cancelled.sentence'),
      };
    case 'exempt':
      return {
        label: t('backgroundCheck.strip.exempt.label'),
        sentence: t('backgroundCheck.strip.exempt.sentence'),
      };
  }
};

export function BackgroundCheckStatusStrip({
  status,
  creditsUsed,
  creditsIncluded,
  planHref,
  canManageBilling,
}: StatusStripProps) {
  const t = useTranslations('people');
  const copy = stripCopy(status, t);
  const remaining = Math.max(0, creditsIncluded - creditsUsed);

  return (
    <div className="mb-6 flex items-center gap-6 rounded-[var(--radius)] border bg-background px-[18px] py-3.5">
      <div className="flex items-center gap-2.5">
        <Badge variant="secondary">
          <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" />
          {copy.label}
        </Badge>
        <Text size="sm" variant="muted">
          {copy.sentence}
        </Text>
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-2 text-sm">
        <Text size="sm" variant="muted">
          {t('backgroundCheck.strip.creditsRemaining')}
        </Text>
        <span className="font-mono tabular-nums">
          {remaining} / {creditsIncluded}
        </span>
        <span aria-hidden className="mx-1 h-3.5 w-px bg-border" />
        {canManageBilling ? (
          <Link
            href={planHref}
            className="text-primary text-sm no-underline hover:underline underline-offset-2"
          >
            {t('backgroundCheck.strip.choosePlan')}
          </Link>
        ) : (
          <Text size="sm" variant="muted">
            {t('backgroundCheck.strip.choosePlan')}
          </Text>
        )}
      </div>
    </div>
  );
}
