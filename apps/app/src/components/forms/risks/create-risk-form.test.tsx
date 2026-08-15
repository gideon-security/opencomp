import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockNextIntl } from '@/test-utils/mocks/next-intl';

const mockPost = vi.fn();

mockNextIntl();

vi.mock('@/hooks/use-api', () => ({
  useApi: () => ({
    post: mockPost,
    organizationId: 'org_123',
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('swr', () => ({
  useSWRConfig: () => ({
    mutate: vi.fn(),
  }),
}));

import { toast } from 'sonner';
import { CreateRisk } from './create-risk-form';

const assignees: any[] = [];

describe('CreateRisk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the create risk form', () => {
    render(<CreateRisk assignees={assignees} />);
    expect(screen.getByLabelText(/create\.riskTitle/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/common\.description/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create\.create/i })).toBeInTheDocument();
  });

  it('calls api.post on submit and shows success toast', async () => {
    mockPost.mockResolvedValue({ data: { id: 'risk_new' }, status: 201 });
    const onSuccess = vi.fn();

    render(<CreateRisk assignees={assignees} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText(/create\.riskTitle/i), {
      target: { value: 'Test Risk' },
    });
    fireEvent.change(screen.getByLabelText(/common\.description/i), {
      target: { value: 'Test description' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create\.create/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/v1/risks',
        expect.objectContaining({
          title: 'Test Risk',
          description: 'Test description',
        }),
      );
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('create.createdToast');
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('shows error toast on api failure', async () => {
    mockPost.mockResolvedValue({ error: 'Server error', status: 500 });

    render(<CreateRisk assignees={assignees} />);

    fireEvent.change(screen.getByLabelText(/create\.riskTitle/i), {
      target: { value: 'Test Risk' },
    });
    fireEvent.change(screen.getByLabelText(/common\.description/i), {
      target: { value: 'Test description' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create\.create/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('create.createFailed');
    });
  });
});
