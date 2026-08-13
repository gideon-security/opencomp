import { SignOut } from '@/components/sign-out';
import { getTranslations } from 'next-intl/server';

/**
 * Shown to a signed-in user who has no active organization membership but was
 * previously a member (all memberships deactivated/removed) — i.e. they were
 * offboarded. Without this, such a user was silently dropped into onboarding,
 * which spawned a spurious empty org and locked them into a loop (CS-569).
 *
 * The most common cause is a domain change: the old account keeps signing in
 * after being offboarded. The primary action is therefore "sign out" so they
 * can sign back in with their current account.
 */
export default async function AccessRemovedPage() {
  const t = await getTranslations('auth');

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6 rounded-lg border p-8 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t('accessRemovedTitle')}</h1>
          <p className="text-muted-foreground">{t('accessRemovedDescription')}</p>
        </div>

        <div className="flex justify-center">
          <SignOut asButton />
        </div>
      </div>
    </div>
  );
}
