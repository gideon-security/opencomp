'use client';

import { OnboardingLoadingAnimation } from '@/components/onboarding-loading-animation';
import { useTranslations } from 'next-intl';

export function RisksLoadingAnimation() {
  const t = useTranslations('risk');
  return (
    <OnboardingLoadingAnimation
      itemType="risks"
      title={t('list.aiWorkingOnRisks')}
      description={t('list.aiWorkingOnRisksDescription')}
    />
  );
}
