'use client';

import { authClient } from '@/utils/auth-client';
import { buildAuthCallbackUrl } from '@/utils/auth-callback';
import { Button } from '@gideon-defender/ui/button';
import { Icons } from '@gideon-defender/ui/icons';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

interface MicrosoftSignInProps {
  inviteCode?: string;
  redirectTo?: string;
}

export function MicrosoftSignIn({ inviteCode, redirectTo }: MicrosoftSignInProps) {
  const t = useTranslations('auth');
  const [isLoading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);

    try {
      const callbackURL = buildAuthCallbackUrl({ inviteCode, redirectTo });

      await authClient.signIn.social({
        provider: 'microsoft',
        callbackURL,
      });
    } catch (error) {
      setLoading(false);

      console.error('[Microsoft Sign-In] Authentication failed:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });

      if (error instanceof Error) {
        if (error.message.includes('redirect_uri_mismatch')) {
          toast.error(t('configurationError'), {
            description: t('configurationErrorDescription'),
          });
        } else if (error.message.includes('invalid_client')) {
          toast.error(t('invalidCredentials'), {
            description: t('invalidCredentialsDescription'),
          });
        } else if (error.message.includes('account_not_linked')) {
          toast.error(t('accountLinkingFailed'), {
            description: t('accountLinkingFailedDescription'),
          });
          console.warn(
            '[Microsoft Sign-In] account_not_linked error occurred despite auto-linking being enabled. Check account linking configuration.',
          );
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          toast.error(t('networkError'), {
            description: t('networkErrorDescription'),
          });
        } else {
          toast.error(t('signInFailed'), {
            description: error.message || t('unexpectedErrorDescription'),
          });
        }
      } else {
        toast.error(t('failedToSignInWithMicrosoft'), {
          description: t('unexpectedErrorDescription'),
        });
      }
    }
  };

  return (
    <Button
      onClick={handleSignIn}
      className="w-full h-11 font-medium"
      variant="outline"
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <Icons.Microsoft className="h-4 w-4" />
          {t('continueWithMicrosoft')}
        </>
      )}
    </Button>
  );
}
