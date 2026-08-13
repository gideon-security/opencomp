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
  const tCommon = useTranslations('overview');
  useEffect(() => {
    console.error('app/(app)/(dashboard)/[orgId]/frameworks/error.tsx', error);
  }, [error]);

  return (
    <div>
      <h2>{tCommon('common.errorOccurred')}</h2>
      <button onClick={reset} type="button">
        {tCommon('common.tryAgain')}
      </button>
    </div>
  );
}
