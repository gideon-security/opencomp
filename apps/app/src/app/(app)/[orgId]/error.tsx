'use client';

import { Button } from '@gideon-defender/ui/button';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

export default function ErrorPage({
  reset,
  error,
}: {
  reset: () => void;
  error: Error & { digest?: string };
}) {
  const t = useTranslations('errors');

  useEffect(() => {
    console.error('app/(app)/(dashboard)/[orgId]/error.tsx', error);
  }, [error]);

  return (
    <div className="h-[calc(100vh-200px)] w-full">
      <div className="mt-8 flex h-full flex-col items-center justify-center">
        <div className="mt-8 mb-8 flex flex-col items-center justify-between text-center">
          <h2 className="mb-4 font-medium">{t('somethingWentWrong')}</h2>
          <p className="text-sm text-[#878787]">{t('unexpectedErrorDescription')}</p>
        </div>

        <div className="flex space-x-4">
          <Button onClick={() => reset()} variant="outline">
            {t('tryAgain')}
          </Button>

          <Link href="/account/support">
            <Button>{t('contactUs')}</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
