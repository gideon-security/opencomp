'use client';

import { Button } from '@gideon-defender/ui/button';
import { useAction } from 'next-safe-action/hooks';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { cancelOnboarding } from '../actions/cancel-onboarding';

interface CancelOnboardingButtonProps {
  organizationId: string;
  hasOtherOrgs: boolean;
}

export function CancelOnboardingButton({
  organizationId,
  hasOtherOrgs,
}: CancelOnboardingButtonProps) {
  const t = useTranslations('onboarding');
  const [confirming, setConfirming] = useState(false);

  const cancelAction = useAction(cancelOnboarding, {
    onSuccess: ({ data }) => {
      if (data?.success) {
        const target = data.fallbackOrgId ? `/${data.fallbackOrgId}` : '/setup';
        window.location.assign(target);
      } else {
        toast.error(data?.error || t('failedToCancel'));
        setConfirming(false);
      }
    },
    onError: ({ error }) => {
      toast.error(error.serverError || t('failedToCancel'));
      setConfirming(false);
    },
  });

  if (!hasOtherOrgs) return null;

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        className="text-muted-foreground"
        onClick={() => setConfirming(true)}
      >
        {t('cancel')}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{t('deleteThisOrg')}</span>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={cancelAction.isExecuting}
        onClick={() => cancelAction.execute({ organizationId })}
      >
        {cancelAction.isExecuting ? t('canceling') : t('yesCancel')}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(false)}
      >
        {t('no')}
      </Button>
    </div>
  );
}
