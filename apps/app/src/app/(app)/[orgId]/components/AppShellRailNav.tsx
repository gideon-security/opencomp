'use client';

import { AppShellRailItem } from '@trycompai/design-system';
import {
  FlaskConical,
  Gauge,
  ListCheck,
  NotebookText,
  Settings,
  Store,
  Users,
  Zap,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';

interface AppShellRailNavProps {
  organizationId: string;
}

export function AppShellRailNav({ organizationId }: AppShellRailNavProps) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const t = useTranslations('nav');

  const orgBase = `/${organizationId}`;

  const isActivePrefix = (prefix: string): boolean => {
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  };

  const items = [
    {
      href: `${orgBase}/overview`,
      label: t('overview'),
      icon: <Gauge />,
      isActive: isActivePrefix(`${orgBase}/overview`),
    },
    {
      href: `${orgBase}/policies`,
      label: t('policies'),
      icon: <NotebookText />,
      isActive: isActivePrefix(`${orgBase}/policies`),
    },
    {
      href: `${orgBase}/tasks`,
      label: t('evidence'),
      icon: <ListCheck />,
      isActive: isActivePrefix(`${orgBase}/tasks`),
    },
    {
      href: `${orgBase}/people/all`,
      label: t('people'),
      icon: <Users />,
      isActive: isActivePrefix(`${orgBase}/people`),
    },
    {
      href: `${orgBase}/vendors`,
      label: t('vendors'),
      icon: <Store />,
      isActive: isActivePrefix(`${orgBase}/vendors`),
    },
    {
      href: `${orgBase}/integrations`,
      label: t('integrations'),
      icon: <Zap />,
      isActive: isActivePrefix(`${orgBase}/integrations`),
    },
    {
      href: `${orgBase}/cloud-tests`,
      label: t('cloudTests'),
      icon: <FlaskConical />,
      isActive: isActivePrefix(`${orgBase}/cloud-tests`),
    },
    {
      href: `${orgBase}/settings`,
      label: t('settings'),
      icon: <Settings />,
      isActive: isActivePrefix(`${orgBase}/settings`),
    },
  ] as const;

  return (
    <>
      {items.map((item) => (
        <AppShellRailItem
          key={item.href}
          isActive={item.isActive}
          icon={item.icon}
          label={item.label}
          type="button"
          onClick={() => router.push(item.href)}
        />
      ))}
    </>
  );
}

