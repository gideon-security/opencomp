'use client';

import { useAuthMe } from '@/hooks/use-auth-me';
import { authClient } from '@/utils/auth-client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ImpersonationBanner() {
  // Milestone 2 — impersonation state comes from GET /v1/auth/me (resolved
  // server-side by HybridAuthGuard), not better-auth session resolution.
  // Stop-impersonating still uses the better-auth admin plugin until it is
  // reimplemented as a native endpoint in Milestone 3 (plan §6 step 15).
  const { user, impersonatedBy, mutate } = useAuthMe();
  const router = useRouter();
  const [stopping, setStopping] = useState(false);

  if (!impersonatedBy) return null;

  const handleStop = async () => {
    setStopping(true);
    try {
      await authClient.admin.stopImpersonating();
      // Revalidate GET /v1/auth/me so the banner hides immediately. Without
      // this the SWR cache still holds the impersonated user (no focus
      // revalidation) and router.refresh() alone does not remount us.
      await mutate();
      const { data: restored } = await authClient.getSession();
      (authClient.$store as { notify: (signal: string) => void }).notify('$sessionSignal');
      const adminOrgId = (restored?.session as Record<string, unknown> | undefined)
        ?.activeOrganizationId;
      if (typeof adminOrgId === 'string' && adminOrgId) {
        router.push(`/${adminOrgId}/admin/organizations`);
      } else {
        router.push('/');
      }
      router.refresh();
    } catch {
      setStopping(false);
    }
  };

  return (
    <div className="flex items-center justify-between border-b bg-destructive/10 px-4 py-1.5 text-xs text-destructive">
      <span>
        Impersonating <span className="font-medium">{user?.name ?? 'a user'}</span> ({user?.email})
      </span>
      <button
        onClick={handleStop}
        disabled={stopping}
        className="rounded-md border border-destructive/30 px-2.5 py-1 font-medium transition-colors hover:bg-destructive/10 disabled:opacity-50"
      >
        {stopping ? 'Stopping...' : 'Stop Impersonating'}
      </button>
    </div>
  );
}
