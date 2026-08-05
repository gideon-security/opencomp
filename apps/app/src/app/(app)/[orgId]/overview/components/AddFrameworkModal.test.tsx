import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseSession = vi.fn();
vi.mock('@/utils/auth-client', () => ({
  useSession: () => mockUseSession(),
}));

const mockAddFrameworks = vi.fn();
vi.mock('@/hooks/use-frameworks', () => ({
  useFrameworks: () => ({
    addFrameworks: mockAddFrameworks,
    frameworks: [],
    isLoading: false,
    error: null,
    mutate: vi.fn(),
    deleteFramework: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

vi.mock('@gideon-defender/ui/button', () => ({
  Button: ({ children, disabled, ...props }: any) => (
    <button disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@gideon-defender/ui/dialog', () => ({
  DialogContent: ({ children }: any) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));

vi.mock('@/components/framework-card', () => ({
  FrameworkCard: ({ framework, isSelected, onSelectionChange }: any) => (
    <div data-testid={`framework-card-${framework.id}`}>
      <label>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelectionChange(e.target.checked)}
          data-testid={`framework-checkbox-${framework.id}`}
        />
        {framework.name}
      </label>
    </div>
  ),
}));

vi.mock('lucide-react', () => ({
  Loader2: () => <span data-testid="loader-icon" />,
}));

import { AddFrameworkModal } from './AddFrameworkModal';

const mockAvailableFrameworks = [
  {
    id: 'fw-1',
    name: 'SOC 2',
    description: 'SOC 2 Type II',
    version: '1.0',
    visible: true,
  },
  {
    id: 'fw-2',
    name: 'ISO 27001',
    description: 'ISO 27001:2022',
    version: '2022',
    visible: true,
  },
];

const defaultProps = {
  onOpenChange: vi.fn(),
  availableFrameworks: mockAvailableFrameworks,
  organizationId: 'org-1',
};

describe('AddFrameworkModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({ data: { user: { role: 'admin' }, session: {} } });
  });

  describe('Permission gating', () => {
    it('enables the "Add Selected" button once a framework is selected, for admin users', () => {
      mockUseSession.mockReturnValue({ data: { user: { role: 'admin' }, session: {} } });

      render(<AddFrameworkModal {...defaultProps} />);

      const checkbox = screen.getByTestId('framework-checkbox-fw-1');
      fireEvent.click(checkbox);

      const addButton = screen.getByRole('button', { name: /add selected/i });
      expect(addButton).not.toBeDisabled();
    });

    it('calls addFrameworks when an admin submits selected frameworks', async () => {
      mockUseSession.mockReturnValue({ data: { user: { role: 'admin' }, session: {} } });
      mockAddFrameworks.mockResolvedValue({ frameworksAdded: 1 });

      render(<AddFrameworkModal {...defaultProps} />);

      fireEvent.click(screen.getByTestId('framework-checkbox-fw-1'));
      fireEvent.click(screen.getByRole('button', { name: /add selected/i }));

      await screen.findByRole('button', { name: /add selected/i });
      expect(mockAddFrameworks).toHaveBeenCalledWith(['fw-1']);
    });

    it('shows a contact-account-manager message instead of adding frameworks for non-admin users', async () => {
      mockUseSession.mockReturnValue({ data: { user: { role: 'member' }, session: {} } });

      render(<AddFrameworkModal {...defaultProps} />);

      fireEvent.click(screen.getByTestId('framework-checkbox-fw-1'));
      fireEvent.click(screen.getByRole('button', { name: /add selected/i }));

      expect(
        await screen.findByText('Contact your account manager'),
      ).toBeInTheDocument();
      expect(mockAddFrameworks).not.toHaveBeenCalled();
    });

    it('allows impersonating staff to add frameworks even without the admin role', async () => {
      mockUseSession.mockReturnValue({
        data: { user: { role: 'member' }, session: { impersonatedBy: 'staff_1' } },
      });
      mockAddFrameworks.mockResolvedValue({ frameworksAdded: 1 });

      render(<AddFrameworkModal {...defaultProps} />);

      fireEvent.click(screen.getByTestId('framework-checkbox-fw-1'));
      fireEvent.click(screen.getByRole('button', { name: /add selected/i }));

      await screen.findByRole('button', { name: /add selected/i });
      expect(mockAddFrameworks).toHaveBeenCalledWith(['fw-1']);
    });
  });

  describe('Rendering', () => {
    it('renders modal title and description', () => {

      render(<AddFrameworkModal {...defaultProps} />);

      expect(screen.getByText('Add Frameworks')).toBeInTheDocument();
      expect(
        screen.getByText(/select the compliance frameworks/i),
      ).toBeInTheDocument();
    });

    it('renders available framework cards', () => {

      render(<AddFrameworkModal {...defaultProps} />);

      expect(screen.getByText('SOC 2')).toBeInTheDocument();
      expect(screen.getByText('ISO 27001')).toBeInTheDocument();
    });

    it('shows empty state when no frameworks available', () => {

      render(
        <AddFrameworkModal
          {...defaultProps}
          availableFrameworks={[]}
        />,
      );

      expect(
        screen.getByText(/all available frameworks are already enabled/i),
      ).toBeInTheDocument();
    });

    it('disables "Add Selected" button when nothing is selected even with permissions', () => {

      render(<AddFrameworkModal {...defaultProps} />);

      const addButton = screen.getByRole('button', { name: /add selected/i });
      expect(addButton).toBeDisabled();
    });
  });
});
