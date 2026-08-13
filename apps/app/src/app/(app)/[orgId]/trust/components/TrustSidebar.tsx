'use client';

import { AppShellNav, AppShellNavItem } from '@trycompai/design-system';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface TrustSidebarProps {
  orgId: string;
}

type TrustNavItem = {
  id: string;
  label: string;
  path: string;
  hidden?: boolean;
};

export function TrustSidebar({ orgId }: TrustSidebarProps) {
  const t = useTranslations('nav');
  const pathname = usePathname() ?? '';

  const items: TrustNavItem[] = [
    { id: 'overview', label: t('overview'), path: `/${orgId}/trust` },
    { id: 'access-requests', label: t('accessRequests'), path: `/${orgId}/trust/access-requests` },
    { id: 'settings', label: t('settings'), path: `/${orgId}/trust/settings` },
  ];

  const isPathActive = (path: string) => {
    if (path === `/${orgId}/trust`) {
      return pathname === path;
    }
    return pathname.startsWith(`${path}`);
  };

  const visibleItems = items.filter((item) => !item.hidden);

  return (
    <AppShellNav>
      {visibleItems.map((item) => (
        <Link key={item.id} href={item.path}>
          <AppShellNavItem isActive={isPathActive(item.path)}>{item.label}</AppShellNavItem>
        </Link>
      ))}
    </AppShellNav>
  );
}
