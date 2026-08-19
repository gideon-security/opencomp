'use client';

import { AppShellNav, AppShellNavItem } from '@trycompai/design-system';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface SettingsSidebarProps {
  orgId: string;
  showBrowserTab: boolean;
  showBillingTab?: boolean;
}

type SettingsNavItem = {
  id: string;
  label: string;
  path: string;
  hidden?: boolean;
};

export function SettingsSidebar({ orgId, showBrowserTab, showBillingTab }: SettingsSidebarProps) {
  const t = useTranslations('nav');
  const pathname = usePathname() ?? '';

  const items: SettingsNavItem[] = [
    { id: 'general', label: t('general'), path: `/${orgId}/settings` },
    {
      id: 'billing',
      label: t('billing'),
      path: `/${orgId}/settings/billing`,
      hidden: !showBillingTab,
    },
    { id: 'context', label: t('context'), path: `/${orgId}/settings/context-hub` },
    { id: 'api', label: t('apiKeys'), path: `/${orgId}/settings/api-keys` },
    { id: 'portal', label: t('portal'), path: `/${orgId}/settings/portal` },
    { id: 'secrets', label: t('secrets'), path: `/${orgId}/settings/secrets` },
    { id: 'roles', label: t('roles'), path: `/${orgId}/settings/roles` },
    { id: 'notifications', label: t('notifications'), path: `/${orgId}/settings/notifications` },
    {
      id: 'browser',
      label: t('browserConnections'),
      path: `/${orgId}/settings/browser-connection`,
      hidden: !showBrowserTab,
    },
    { id: 'user', label: t('userSettings'), path: `/${orgId}/settings/user` },
  ];

  const isPathActive = (path: string) => {
    if (path === `/${orgId}/settings`) {
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
