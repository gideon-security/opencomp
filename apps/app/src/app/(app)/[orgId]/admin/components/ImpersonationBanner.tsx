'use client';

import { useAuthMe } from '@/hooks/use-auth-me';
import { api } from '@/lib/api-client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface StopImpersonatingResponse {
  success: boolean;
  activeOrganizationId: string | null;
}

export function ImpersonationBanner() {
  // Impersonation state comes from GET /v1/auth/me (resolved server-side by
  // HybridAuthGuard); stopping goes through the native admin endpoint, which
  // restores the admin session cookie and returns its org for the landing.
  const { user, impersonatedBy, mutate } = useAuthMe();
  const router = useRouter();
  const [stopping, setStopping] = useState(false);

  if (!impersonatedBy) return null;

  const handleStop = async () => {
    setStopping(true);
    try {
      const res = await api.post<StopImpersonatingResponse>('/v1/admin/stop-impersonating');
      if (res.error || !res.data?.success) {
        throw new Error(res.error ?? 'Failed to stop impersonating');
      }
      // Revalidate GET /v1/auth/me so the banner hides immediately. Without
      // this the SWR cache still holds the impersonated user (no focus
      // revalidation) and router.refresh() alone does not remount us.
      await mutate();
      const adminOrgId = res.data.activeOrganizationId;
      if (adminOrgId) {
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
