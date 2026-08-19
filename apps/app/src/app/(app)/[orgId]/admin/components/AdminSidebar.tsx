'use client';

import { AppShellNav, AppShellNavItem } from '@trycompai/design-system';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface AdminSidebarProps {
  orgId: string;
}

export function AdminSidebar({ orgId }: AdminSidebarProps) {
  const t = useTranslations('nav');
  const pathname = usePathname() ?? '';

  const items = [
    { id: 'organizations', label: t('organizations'), path: `/${orgId}/admin/organizations` },
    { id: 'integrations', label: t('integrations'), path: `/${orgId}/admin/integrations` },
    {
      id: 'timeline-templates',
      label: t('timelineTemplates'),
      path: `/${orgId}/admin/timeline-templates`,
    },
    {
      id: 'finding-templates',
      label: t('findingTemplates'),
      path: `/${orgId}/admin/finding-templates`,
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
