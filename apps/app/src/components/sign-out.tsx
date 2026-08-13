'use client';

import { authClient } from '@/utils/auth-client';
import { Button } from '@gideon-defender/ui/button';
import { DropdownMenuItem } from '@gideon-defender/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

export function SignOut({
  asButton = false,
  className = '',
  size = 'sm',
}: {
  asButton?: boolean;
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
}) {
  const t = useTranslations('auth');
  const router = useRouter();
  const [isLoading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push('/auth');
        },
      },
    });
  };

  if (asButton) {
    return (
      <Button onClick={handleSignOut} className={className} size={size}>
        {isLoading ? t('loading') : t('signOut')}
      </Button>
    );
  }

  return (
    <DropdownMenuItem onClick={handleSignOut}>
      {isLoading ? t('loading') : t('signOut')}
    </DropdownMenuItem>
  );
}
