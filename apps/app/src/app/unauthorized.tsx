import { Button } from '@gideon-defender/ui/button';
import { Card } from '@gideon-defender/ui/card';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export default async function UnauthorizedPage() {
  const t = await getTranslations('unauthorized');

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Card className="w-full max-w-lg space-y-6 p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>

        <div className="flex justify-center">
          <Button asChild>
            <Link href="/">{t('returnHome')}</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
