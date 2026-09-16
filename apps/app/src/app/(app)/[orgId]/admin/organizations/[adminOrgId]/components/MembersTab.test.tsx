import { mockNextIntl } from '@/test-utils/mocks/next-intl';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

mockNextIntl();

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();

vi.mock('@/lib/api-client', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { MembersTab } from './MembersTab';

const mockMembers = [
  {
    id: 'mem_1',
    role: 'owner',
    createdAt: '2026-01-01T00:00:00Z',
    user: {
      id: 'usr_1',
      name: 'Alice Owner',
      email: 'alice@acme.com',
      image: null,
    },
  },
  {
    id: 'mem_2',
    role: 'admin',
    createdAt: '2026-02-01T00:00:00Z',
    user: {
      id: 'usr_2',
      name: 'Bob Admin',
      email: 'bob@acme.com',
      image: null,
    },
  },
];

const mockInvitations = [
  {
    id: 'inv_1',
    email: 'charlie@acme.com',
    role: 'employee',
    status: 'pending',
    expiresAt: '2026-04-01T00:00:00Z',
    createdAt: '2026-03-01T00:00:00Z',
    user: { name: 'Platform Admin', email: 'admin@platform.com' },
  },
];

describe('MembersTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders members table', async () => {
    mockGet.mockResolvedValue({ data: [] });
    render(<MembersTab orgId="org_1" orgName="Acme Corp" members={mockMembers} />);

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(screen.getByText('Alice Owner')).toBeInTheDocument();
    expect(screen.getByText('Bob Admin')).toBeInTheDocument();
    expect(screen.getByText('alice@acme.com')).toBeInTheDocument();
    expect(screen.getByText(/organizations\.membersTab\.members/i)).toBeInTheDocument();
  });

  it('fetches and renders pending invitations', async () => {
    mockGet.mockResolvedValue({ data: mockInvitations });
    render(<MembersTab orgId="org_1" orgName="Acme Corp" members={mockMembers} />);

    await waitFor(() => {
      expect(screen.getByText('charlie@acme.com')).toBeInTheDocument();
    });

    expect(mockGet).toHaveBeenCalledWith('/v1/admin/organizations/org_1/invitations');
  });

  it('shows empty state when no pending invitations', async () => {
    mockGet.mockResolvedValue({ data: [] });
    render(<MembersTab orgId="org_1" orgName="Acme Corp" members={mockMembers} />);

    await waitFor(() => {
      expect(screen.getByText(/organizations\.membersTab\.noInvitations/i)).toBeInTheDocument();
    });
  });

  it('shows Invite Member button', async () => {
    mockGet.mockResolvedValue({ data: [] });
    render(<MembersTab orgId="org_1" orgName="Acme Corp" members={mockMembers} />);

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(
      screen.getByRole('button', {
        name: /organizations\.membersTab\.inviteMember/i,
      }),
    ).toBeInTheDocument();
  });

  it('renders Login As buttons for each member', async () => {
    mockGet.mockResolvedValue({ data: [] });
    render(<MembersTab orgId="org_1" orgName="Acme Corp" members={mockMembers} />);

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    const loginButtons = screen.getAllByRole('button', {
      name: /organizations\.membersTab\.loginAs/i,
    });
    expect(loginButtons).toHaveLength(2);
  });

  it('calls correct invitations API endpoint', async () => {
    mockGet.mockResolvedValue({ data: [] });
    render(<MembersTab orgId="org_test" orgName="Test Corp" members={[]} />);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/v1/admin/organizations/org_test/invitations');
    });
  });

  describe('impersonation confirmation dialog', () => {
    it('does NOT call the impersonate endpoint immediately on Login As click', async () => {
      mockGet.mockResolvedValue({ data: [] });
      render(<MembersTab orgId="org_1" orgName="Acme Corp" members={mockMembers} />);

      const loginButtons = screen.getAllByRole('button', {
        name: /organizations\.membersTab\.loginAs/i,
      });
      fireEvent.click(loginButtons[0]);

      expect(mockPost).not.toHaveBeenCalledWith('/v1/admin/impersonate', expect.anything());
      await waitFor(() => expect(mockGet).toHaveBeenCalled());
    });

    it('shows confirmation dialog when Login As is clicked', async () => {
      mockGet.mockResolvedValue({ data: [] });
      render(<MembersTab orgId="org_1" orgName="Acme Corp" members={mockMembers} />);

      const loginButtons = screen.getAllByRole('button', {
        name: /organizations\.membersTab\.loginAs/i,
      });
      fireEvent.click(loginButtons[0]);

      await waitFor(() => {
        expect(
          screen.getByText(/organizations\.membersTab\.impersonate\.title/i),
        ).toBeInTheDocument();
      });

      expect(
        screen.getByText(/organizations\.membersTab\.impersonate\.descriptionPrefix/i),
      ).toBeInTheDocument();
    });

    it('describes security implications in the confirmation dialog', async () => {
      mockGet.mockResolvedValue({ data: [] });
      render(<MembersTab orgId="org_1" orgName="Acme Corp" members={mockMembers} />);

      const loginButtons = screen.getAllByRole('button', {
        name: /organizations\.membersTab\.loginAs/i,
      });
      fireEvent.click(loginButtons[0]);

      await waitFor(() => {
        expect(
          screen.getByText(/organizations\.membersTab\.impersonate\.descriptionSuffix/i),
        ).toBeInTheDocument();
      });
    });

    it('has a Cancel button that closes the dialog', async () => {
      mockGet.mockResolvedValue({ data: [] });
      render(<MembersTab orgId="org_1" orgName="Acme Corp" members={mockMembers} />);

      const loginButtons = screen.getAllByRole('button', {
        name: /organizations\.membersTab\.loginAs/i,
      });
      fireEvent.click(loginButtons[0]);

      await waitFor(() => {
        expect(
          screen.getByText(/organizations\.membersTab\.impersonate\.title/i),
        ).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByRole('button', {
          name: /organizations\.membersTab\.cancel/i,
        }),
      );

      await waitFor(() => {
        expect(
          screen.queryByText(/organizations\.membersTab\.impersonate\.title/i),
        ).not.toBeInTheDocument();
      });
    });

    it('calls the native impersonate endpoint and lands on the org overview', async () => {
      mockPost.mockResolvedValue({ data: { success: true, userId: 'usr_1' } });
      mockGet.mockResolvedValue({ data: [] });

      render(<MembersTab orgId="org_1" orgName="Acme Corp" members={mockMembers} />);

      const loginButtons = screen.getAllByRole('button', {
        name: /organizations\.membersTab\.loginAs/i,
      });
      fireEvent.click(loginButtons[0]);

      await waitFor(() => {
        expect(
          screen.getByText(/organizations\.membersTab\.impersonate\.title/i),
        ).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByRole('button', {
          name: /organizations\.membersTab\.impersonate\.confirm$/i,
        }),
      );

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/v1/admin/impersonate', { userId: 'usr_1' });
      });
      expect(mockPush).toHaveBeenCalledWith('/org_1/overview');
    });

    it('stays put when impersonation fails', async () => {
      mockPost.mockResolvedValue({ error: 'Cannot impersonate a banned user' });
      mockGet.mockResolvedValue({ data: [] });

      render(<MembersTab orgId="org_1" orgName="Acme Corp" members={mockMembers} />);

      const loginButtons = screen.getAllByRole('button', {
        name: /organizations\.membersTab\.loginAs/i,
      });
      fireEvent.click(loginButtons[0]);

      await waitFor(() => {
        expect(
          screen.getByText(/organizations\.membersTab\.impersonate\.title/i),
        ).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByRole('button', {
          name: /organizations\.membersTab\.impersonate\.confirm$/i,
        }),
      );

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/v1/admin/impersonate', { userId: 'usr_1' });
      });
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
