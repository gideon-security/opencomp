import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockNextIntl } from '@/test-utils/mocks/next-intl';

mockNextIntl();

vi.mock('@/lib/api-client', () => {
  const api = {
    // TasksTab reads `res.data.data`, FindingsTab reads `res.data` directly.
    get: vi.fn((url: string) =>
      Promise.resolve(
        url.includes('/tasks') ? { data: { data: [] } } : { data: [] },
      ),
    ),
    post: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  };
  const apiClient = {
    get: vi.fn().mockResolvedValue({ data: { data: [], total: 0 } }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  };
  return { api, apiClient };
});

vi.mock('@/utils/auth-client', () => ({
  authClient: {
    admin: {
      impersonateUser: vi.fn(),
      stopImpersonating: vi.fn(),
    },
    organization: {
      setActive: vi.fn(),
    },
  },
}));

vi.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({
    permissions: {},
    hasPermission: () => true,
  }),
}));

// FindingsTab always mounts CreateFindingSheet; its own data-fetching hooks
// are out of scope for these tab-switching tests.
vi.mock('@/app/(app)/[orgId]/overview/components/CreateFindingSheet', () => ({
  CreateFindingSheet: () => null,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/org_1/admin/organizations/org_2',
}));

import { AdminOrgTabs, type AdminOrgDetail } from './AdminOrgTabs';

const mockOrg: AdminOrgDetail = {
  id: 'org_2',
  name: 'Test Org',
  slug: 'test-org',
  logo: null,
  createdAt: '2026-01-01T00:00:00Z',
  hasAccess: true,
  onboardingCompleted: true,
  website: 'https://test.com',
  backgroundCheckStepEnabled: true,
  isInternal: false,
  members: [
    {
      id: 'mem_1',
      role: 'owner',
      createdAt: '2026-01-01T00:00:00Z',
      user: {
        id: 'usr_1',
        name: 'Test Owner',
        email: 'owner@test.com',
        image: null,
      },
    },
  ],
};

describe('AdminOrgTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all tab triggers', async () => {
    render(<AdminOrgTabs org={mockOrg} currentOrgId="org_1" />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /findings/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /frameworks/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /tasks/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /vendors/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /context/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /evidence/i })).toBeInTheDocument();
  });

  it('renders the page header with org name', async () => {
    render(<AdminOrgTabs org={mockOrg} currentOrgId="org_1" />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('heading', { name: 'Test Org' })).toBeInTheDocument();
  });

  it('shows active badge for active org', async () => {
    render(<AdminOrgTabs org={mockOrg} currentOrgId="org_1" />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
  });

  it('switches to findings tab on click', async () => {
    render(<AdminOrgTabs org={mockOrg} currentOrgId="org_1" />);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole('tab', { name: /findings/i }));
    expect(screen.getByText(/loading findings/i)).toBeInTheDocument();
    await act(async () => {
      await Promise.resolve();
    });
  });

  it('switches to tasks tab on click', async () => {
    render(<AdminOrgTabs org={mockOrg} currentOrgId="org_1" />);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole('tab', { name: /tasks/i }));
    expect(screen.getByText(/loading tasks/i)).toBeInTheDocument();
    await act(async () => {
      await Promise.resolve();
    });
  });
});
