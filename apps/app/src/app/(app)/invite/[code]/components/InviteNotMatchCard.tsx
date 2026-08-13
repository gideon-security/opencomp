'use client';

import { SignOut } from '@/components/sign-out';
import { useTranslations } from 'next-intl';
import { InviteStatusCard } from './InviteStatusCard';

export function InviteNotMatchCard({
  currentEmail,
  invitedEmail,
}: {
  currentEmail: string;
  invitedEmail: string;
}) {
  const t = useTranslations('invite');
  return (
    <InviteStatusCard
      title={t('wrongAccount')}
      description={t('wrongAccountDescription')}
    >
      <div className="mx-auto max-w-[42ch] text-muted-foreground leading-relaxed flex flex-col gap-4">
        <div className="space-y-2 text-sm">
          <p>
            {t('signedInAs')}
            <span className="mx-1 inline-flex items-center rounded-xs border border-muted bg-muted/40 px-2 py-0.5 text-sm">
              {currentEmail}
            </span>
          </p>
          <p>
            {t('inviteFor')}
            <span className="mx-1 inline-flex items-center rounded-xs border border-muted bg-muted/40 px-2 py-0.5 text-sm">
              {invitedEmail}
            </span>
          </p>
        </div>
      </div>
      <SignOut asButton className="w-full" />
    </InviteStatusCard>
  );
}
