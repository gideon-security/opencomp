import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock child components
vi.mock('../forms/risks/risk-overview', () => ({
  UpdateRiskOverview: () => <div data-testid="update-risk-overview" />,
}));

// Mock design-system
vi.mock('@trycompai/design-system', () => ({
  Section: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

import { RiskOverview } from './risk-overview';

const mockRisk: any = {
  id: 'risk_1',
  title: 'Test Risk Title',
  description: 'Test risk description',
  assignee: null,
};

const mockAssignees: any[] = [];

describe('RiskOverview', () => {
  it('renders the "Risk Settings" section', () => {
    render(<RiskOverview risk={mockRisk} assignees={mockAssignees} />);

    expect(screen.getByText('Risk Settings')).toBeInTheDocument();
  });

  it('always renders the UpdateRiskOverview child component', () => {
    render(<RiskOverview risk={mockRisk} assignees={mockAssignees} />);

    expect(screen.getByTestId('update-risk-overview')).toBeInTheDocument();
  });
});
