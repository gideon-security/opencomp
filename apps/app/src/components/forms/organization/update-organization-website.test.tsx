import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdateOrganization = vi.fn();

vi.mock('@/hooks/use-organization-mutations', () => ({
  useOrganizationMutations: () => ({
    updateOrganization: mockUpdateOrganization,
  }),
}));

vi.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({
    permissions: {},
    hasPermission: () => true,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from 'sonner';
import { UpdateOrganizationWebsite } from './update-organization-website';

describe('UpdateOrganizationWebsite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with the current website', () => {
    render(<UpdateOrganizationWebsite organizationWebsite="https://acme.com" />);
    expect(screen.getByDisplayValue('https://acme.com')).toBeInTheDocument();
  });

  it('calls updateOrganization on submit and shows success toast', async () => {
    mockUpdateOrganization.mockResolvedValue({ website: 'https://new.com' });

    render(<UpdateOrganizationWebsite organizationWebsite="https://acme.com" />);

    const input = screen.getByDisplayValue('https://acme.com');
    fireEvent.change(input, { target: { value: 'https://new.com' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockUpdateOrganization).toHaveBeenCalledWith({
        website: 'https://new.com',
      });
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Organization website updated');
    });
  });

  it('shows error toast when the update fails', async () => {
    mockUpdateOrganization.mockRejectedValue(new Error('Forbidden'));

    render(<UpdateOrganizationWebsite organizationWebsite="https://acme.com" />);

    const input = screen.getByDisplayValue('https://acme.com');
    fireEvent.change(input, { target: { value: 'https://new.com' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Error updating organization website');
    });
  });
});
