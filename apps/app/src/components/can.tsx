'use client';

import { usePermissions } from '@/hooks/use-permissions';

type CanProps = {
  /** Permission to check, e.g. "risk:update" or separate resource/action */
  permission?: string;
  resource?: string;
  action?: string;
  /** Render fallback when permission denied */
  fallback?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Declarative permission gate for client components.
 * Replaces 60+ `hasPermission` one-liners:
 *
 *   const { hasPermission } = usePermissions();
 *   const canUpdate = hasPermission('risk','update');
 *   if (!canUpdate) return null;
 *
 * With:
 *   <Can permission="risk:update"><Button /></Can>
 *   <Can resource="framework" action="create" fallback={null}>...</Can>
 */
export function Can({ permission, resource, action, fallback = null, children }: CanProps) {
  const { hasPermission } = usePermissions();

  let allowed = false;
  if (permission) {
    const [res, act] = permission.split(':');
    if (res && act) allowed = hasPermission(res, act);
  } else if (resource && action) {
    allowed = hasPermission(resource, action);
  }

  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Hook variant for imperative checks (when you need boolean).
 * Thin wrapper around usePermissions().hasPermission for consistency.
 */
export function useCan() {
  const { hasPermission } = usePermissions();
  return (resource: string, action: string) => hasPermission(resource, action);
}
