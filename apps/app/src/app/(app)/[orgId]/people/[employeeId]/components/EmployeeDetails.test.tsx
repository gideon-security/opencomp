import type { Member, User } from '@db';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockNextIntl } from '@/test-utils/mocks/next-intl';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeDetails } from './EmployeeDetails';

mockNextIntl();

const { mockPatch } = vi.hoisted(() => ({ mockPatch: vi.fn() }));

vi.mock('@/hooks/use-api', () => ({
  useApi: () => ({
    organizationId: 'org_1',
    patch: mockPatch,
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }),
}));

// DepartmentSelect pulls the runtime `Departments` enum from @db; its behaviour
// is irrelevant to email editing.
vi.mock('@/components/DepartmentSelect', () => ({
  DepartmentSelect: () => null,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const employee = {
  id: 'mem_1',
  userId: 'usr_1',
  organizationId: 'org_1',
  role: 'employee',
  createdAt: new Date(),
  department: 'engineering',
  jobTitle: 'Engineer',
  isActive: true,
  onboardDate: null,
  offboardDate: null,
  user: {
    id: 'usr_1',
    name: 'Manoj Madhavan',
    email: 'manoj.madhavan@plurilock.com',
  },
} as unknown as Member & { user: User };

describe('EmployeeDetails email editing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPatch.mockResolvedValue({ data: {}, status: 200 });
  });

  it('lets an admin change the login email and PATCHes it to the people endpoint', async () => {
    const user = userEvent.setup();
    render(<EmployeeDetails employee={employee} canEdit />);

    const emailInput = screen.getByLabelText('employeeDetails.email');
    // Regression: the field used to be hardcoded disabled+readOnly.
    expect(emailInput).not.toBeDisabled();

    await user.clear(emailInput);
    await user.type(emailInput, 'mmadhavan@aurorait.com');
    await user.click(screen.getByRole('button', { name: 'employeeDetails.save' }));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/v1/people/mem_1', {
        email: 'mmadhavan@aurorait.com',
      });
    });
  });

  it('disables the email field for read-only users', () => {
    render(<EmployeeDetails employee={employee} canEdit={false} />);
    expect(screen.getByLabelText('employeeDetails.email')).toBeDisabled();
  });

  it('blocks save and does not PATCH when the email is cleared', async () => {
    const user = userEvent.setup();
    render(<EmployeeDetails employee={employee} canEdit />);

    const emailInput = screen.getByLabelText('employeeDetails.email');
    await user.clear(emailInput);
    await user.click(screen.getByRole('button', { name: 'employeeDetails.save' }));

    expect(toast.error).toHaveBeenCalledWith('employeeDetails.emailRequired');
    expect(mockPatch).not.toHaveBeenCalled();
  });
});
