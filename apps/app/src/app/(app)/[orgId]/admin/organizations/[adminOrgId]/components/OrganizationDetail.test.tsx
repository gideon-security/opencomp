import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockNextIntl } from '@/test-utils/mocks/next-intl';

mockNextIntl();

import { OrganizationDetail } from './OrganizationDetail';

const patchMock = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: { data: [] } }),
    patch: (...args: unknown[]) => patchMock(...args),
  },
}));

const baseOrg = {
  id: 'org_1',
  name: 'Acme',
  logo: null,
  createdAt: new Date().toISOString(),
  onboardingCompleted: true,
  members: [],
  backgroundCheckStepEnabled: true,
  isInternal: false,
};

describe('OrganizationDetail — background-check toggle', () => {
  beforeEach(() => {
    patchMock.mockReset();
    patchMock.mockResolvedValue({ data: { success: true } });
  });

  it('shows the toggle in its current state', async () => {
    render(
      <OrganizationDetail
        org={baseOrg}
        currentOrgId="org_1"
        hasAccess={true}
      />,
    );

    await screen.findByText(/activity will appear here when changes are made/i);

    const toggle = screen.getByRole('switch', {
      name: /organizations\.detail\.requireBackgroundChecks/i,
    });
    expect(toggle).toBeChecked();
  });

  it('toggles off and PATCHes the new value', async () => {
    const user = userEvent.setup();

    render(
      <OrganizationDetail
        org={baseOrg}
        currentOrgId="org_1"
        hasAccess={true}
      />,
    );

    const toggle = screen.getByRole('switch', {
      name: /organizations\.detail\.requireBackgroundChecks/i,
    });

    await user.click(toggle);

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledWith(
        '/v1/admin/organizations/org_1',
        { backgroundCheckStepEnabled: false },
      );
    });
  });

  it('rolls back to checked state when PATCH fails', async () => {
    patchMock.mockResolvedValue({ error: 'server error' });
    const user = userEvent.setup();

    render(
      <OrganizationDetail
        org={baseOrg}
        currentOrgId="org_1"
        hasAccess={true}
      />,
    );

    const toggle = screen.getByRole('switch', {
      name: /organizations\.detail\.requireBackgroundChecks/i,
    });
    await user.click(toggle);

    await waitFor(() => {
      expect(toggle).toBeChecked();
    });
  });
});

describe('OrganizationDetail — internal-organization toggle', () => {
  beforeEach(() => {
    patchMock.mockReset();
    patchMock.mockResolvedValue({ data: { success: true } });
  });

  it('asks for confirmation before saving (no PATCH on the toggle click)', async () => {
    const user = userEvent.setup();

    render(
      <OrganizationDetail org={baseOrg} currentOrgId="org_1" hasAccess={true} />,
    );

    await user.click(
      screen.getByRole('switch', { name: /organizations\.detail\.internalOrganization/i }),
    );

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(patchMock).not.toHaveBeenCalled();
  });

  it('PATCHes isInternal only after the change is confirmed', async () => {
    const user = userEvent.setup();

    render(
      <OrganizationDetail org={baseOrg} currentOrgId="org_1" hasAccess={true} />,
    );

    await user.click(
      screen.getByRole('switch', { name: /organizations\.detail\.internalOrganization/i }),
    );
    await user.click(
      await screen.findByRole('button', {
        name: /organizations\.detail\.markInternalAction/i,
      }),
    );

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledWith('/v1/admin/organizations/org_1', {
        isInternal: true,
      });
    });
  });

  it('does not PATCH when the confirmation is canceled', async () => {
    const user = userEvent.setup();

    render(
      <OrganizationDetail org={baseOrg} currentOrgId="org_1" hasAccess={true} />,
    );

    await user.click(
      screen.getByRole('switch', { name: /organizations\.detail\.internalOrganization/i }),
    );
    await user.click(await screen.findByRole('button', {
        name: /organizations\.detail\.cancel/i,
      }));

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(patchMock).not.toHaveBeenCalled();
  });
});
