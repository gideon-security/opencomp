import { requireRoutePermission } from './permissions.server';

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
};

/**
 * Factory for permission-guarded layouts.
 * Replaces 13-line boilerplate in 18 `layout.tsx` files.
 *
 * @example
 * // apps/app/src/app/(app)/[orgId]/risk/layout.tsx
 * import { createGuardedLayout } from '@/lib/layout-helpers';
 * export default createGuardedLayout('risk');
 */
export function createGuardedLayout(segment: string) {
  return async function GuardedLayout({ children, params }: LayoutProps) {
    const { orgId } = await params;
    await requireRoutePermission(segment, orgId);
    return children;
  };
}
