'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('overview');
  useEffect(() => {
    console.error('app/(app)/[orgId]/overview/error.tsx', error);
  }, [error]);

  return (
    <div>
      <h2>{t('common.errorOccurred')}</h2>
      <button onClick={reset} type="button">
        {t('common.tryAgain')}
      </button>
    </div>
  );
}
