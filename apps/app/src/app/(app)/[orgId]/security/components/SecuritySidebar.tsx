'use client';

import { AppShellNav, AppShellNavItem } from '@trycompai/design-system';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface SecuritySidebarProps {
  orgId: string;
}

export function SecuritySidebar({ orgId }: SecuritySidebarProps) {
  const t = useTranslations('nav');
  const pathname = usePathname() ?? '';

  const items = [
    {
      id: 'penetration-tests',
      label: t('penetrationTests'),
      path: `/${orgId}/security/penetration-tests`,
    },
  ];

  const isPathActive = (path: string) => pathname.startsWith(path);

  return (
    <AppShellNav>
      {items.map((item) => (
        <Link key={item.id} href={item.path}>
          <AppShellNavItem isActive={isPathActive(item.path)}>{item.label}</AppShellNavItem>
        </Link>
      ))}
    </AppShellNav>
  );
}
