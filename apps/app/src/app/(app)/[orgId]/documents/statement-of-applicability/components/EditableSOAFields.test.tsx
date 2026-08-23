import { render, screen } from '@testing-library/react';
import { mockNextIntl } from '@/test-utils/mocks/next-intl';
import { describe, expect, it, vi } from 'vitest';
import { EditableSOAFields } from './EditableSOAFields';

mockNextIntl();

vi.mock('../hooks/useSOADocument', () => ({
  useSOADocument: () => ({
    saveAnswer: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe('EditableSOAFields', () => {
  it('shows the edit action without requiring hover', () => {
    render(
      <EditableSOAFields
        documentId="doc_1"
        questionId="q_1"
        isApplicable
        justification={null}
        isPendingApproval={false}
        organizationId="org_1"
      />,
    );

    expect(screen.getByRole('button', { name: 'soa.editAnswer' })).toHaveClass('opacity-100');
  });
});
