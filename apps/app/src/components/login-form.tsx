'use client';

import { GideonSignIn } from '@/components/gideon-sign-in';

interface LoginFormProps {
  inviteCode?: string;
  redirectTo?: string;
}

/**
 * Gideon is the sole authenticator — the form renders only the
 * "Continue with Gideon" button.
 */
export function LoginForm({ inviteCode, redirectTo }: LoginFormProps) {
  return (
    <div className="space-y-4">
      <GideonSignIn inviteCode={inviteCode} redirectTo={redirectTo} />
    </div>
  );
}
