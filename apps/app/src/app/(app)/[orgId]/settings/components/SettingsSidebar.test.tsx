import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { mockNextIntl } from '@/test-utils/mocks/next-intl';
import { SettingsSidebar } from './SettingsSidebar';

mockNextIntl();

vi.mock('next/navigation', () => ({
  usePathname: () => '/org-1/settings',
}));

vi.mock('@trycompai/design-system', () => ({
  AppShellNav: ({ children }: { children: React.ReactNode }) => <nav>{children}</nav>,
  AppShellNavItem: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

describe('SettingsSidebar', () => {
  it('places Billing directly after General when visible', () => {
    render(<SettingsSidebar orgId="org-1" showBillingTab={true} showBrowserTab={false} />);

    const links = screen.getAllByRole('link').map((link) => link.textContent);
    expect(links.slice(0, 3)).toEqual(['general', 'billing', 'context']);
  });

  it('hides Billing when the billing tab is disabled', () => {
    render(<SettingsSidebar orgId="org-1" showBillingTab={false} showBrowserTab={false} />);

    expect(screen.queryByRole('link', { name: 'billing' })).not.toBeInTheDocument();
  });

  it('hides Browser even when the browser tab flag is enabled', () => {
    render(<SettingsSidebar orgId="org-1" showBillingTab={true} showBrowserTab={true} />);

    expect(screen.queryByRole('link', { name: 'browser' })).not.toBeInTheDocument();
  });
});
