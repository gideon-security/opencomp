import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockNextIntl } from '@/test-utils/mocks/next-intl';
import {
  setMockPermissions,
  mockHasPermission,
  ADMIN_PERMISSIONS,
} from '@/test-utils/mocks/permissions';

mockNextIntl();

// Mock usePermissions
vi.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({
    permissions: {},
    hasPermission: mockHasPermission,
  }),
}));

// Mock useRisk hook
const mockRisk = {
  id: 'risk_1',
  title: 'Test Risk',
  description: 'A test risk description',
  category: 'other',
  department: null,
  status: 'open',
  likelihood: 'possible',
  impact: 'moderate',
  residualLikelihood: 'unlikely',
  residualImpact: 'minor',
  treatmentStrategy: 'mitigate',
  treatmentStrategyDescription: null,
  organizationId: 'org_123',
  assigneeId: null,
  assignee: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
};

vi.mock('@/hooks/use-risks', () => ({
  useRisk: () => ({
    risk: mockRisk,
  }),
  useRiskActions: () => ({
    updateRisk: vi.fn(),
    regenerateMitigation: vi.fn().mockResolvedValue({
      runId: 'run_test',
      publicAccessToken: 'tok_test',
    }),
    suggestRiskLinks: vi.fn(),
    applyRiskLinks: vi.fn(),
    fetchActiveRiskAutoLinkRun: vi.fn().mockResolvedValue(null),
    discardRiskAutoLinkRun: vi.fn(),
  }),
}));

// Mock useTaskItems / useTaskItemActions
vi.mock('@/hooks/use-task-items', () => ({
  useTaskItems: () => ({
    data: { data: { data: [] } },
    mutate: vi.fn(),
  }),
  useTaskItemActions: () => ({
    updateTaskItem: vi.fn(),
  }),
}));

// Mock useAuditLogs
vi.mock('@/hooks/use-audit-logs', () => ({
  useAuditLogs: () => ({ logs: [] }),
}));

// Mock @db
vi.mock('@db', () => ({
  CommentEntityType: { risk: 'risk' },
  Likelihood: {
    very_unlikely: 'very_unlikely',
    unlikely: 'unlikely',
    possible: 'possible',
    likely: 'likely',
    very_likely: 'very_likely',
  },
  Impact: {
    insignificant: 'insignificant',
    minor: 'minor',
    moderate: 'moderate',
    major: 'major',
    severe: 'severe',
  },
  RiskTreatmentType: {
    accept: 'accept',
    avoid: 'avoid',
    mitigate: 'mitigate',
    transfer: 'transfer',
  },
  TaskStatus: {
    todo: 'todo',
    in_progress: 'in_progress',
    done: 'done',
    not_relevant: 'not_relevant',
  },
}));

// Mock nuqs — tab state is controlled via `setActiveTab` so individual
// tests can render with the tab panel they need to assert against.
const { getActiveTab, setActiveTab } = vi.hoisted(() => {
  let tab = 'overview';
  return {
    getActiveTab: () => tab,
    setActiveTab: (next: string) => {
      tab = next;
    },
  };
});

vi.mock('nuqs', () => ({
  useQueryState: (key: string, options?: { defaultValue?: string }) => [
    key === 'tab' ? getActiveTab() : (options?.defaultValue ?? ''),
    vi.fn((next: string) => setActiveTab(next)),
  ],
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock design system
vi.mock('@trycompai/design-system', () => ({
  Breadcrumb: ({ items }: { items: Array<{ label: string }> }) => (
    <nav data-testid="breadcrumb">
      {items.map((item, i) => (
        <span key={i}>{item.label}</span>
      ))}
    </nav>
  ),
  HStack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <button data-tab-trigger={value}>{children}</button>
  ),
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

// Mock child components
vi.mock('@/components/comments/Comments', () => ({
  Comments: () => <div data-testid="comments" />,
}));

vi.mock('@/components/RecentAuditLogs', () => ({
  RecentAuditLogs: () => <div data-testid="recent-audit-logs" />,
}));

vi.mock('@/components/risks/acceptance/ResidualAcceptanceCard', () => ({
  ResidualAcceptanceCard: () => <div data-testid="residual-acceptance-card" />,
}));

vi.mock('@/components/risks/charts/InherentRiskChart', () => ({
  InherentRiskChart: () => <div data-testid="inherent-risk-chart" />,
}));

vi.mock('@/components/risks/charts/ResidualRiskChart', () => ({
  ResidualRiskChart: () => <div data-testid="residual-risk-chart" />,
}));

vi.mock('@/components/risks/risk-overview', () => ({
  RiskOverview: () => <div data-testid="risk-overview" />,
}));

vi.mock('@/components/risks/treatment-plan/TreatmentPlanTab', () => ({
  TreatmentPlanTab: () => <div data-testid="treatment-plan-tab" />,
}));

vi.mock('@/components/task-items/TaskItems', () => ({
  TaskItems: () => <div data-testid="task-items" />,
}));

import { RiskPageClient } from './RiskPageClient';

const initialRisk = {
  ...mockRisk,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-02T00:00:00Z'),
} as any;

const defaultProps = {
  riskId: 'risk_1',
  orgId: 'org_123',
  initialRisk,
  assignees: [],
  taskItemId: null,
};

describe('RiskPageClient permission gating', () => {
  beforeEach(() => {
    setMockPermissions({});
    setActiveTab('overview');
    vi.clearAllMocks();
  });

  it('renders the page header with risk title', () => {
    setMockPermissions(ADMIN_PERMISSIONS);

    render(<RiskPageClient {...defaultProps} />);

    expect(screen.getAllByText('Test Risk').length).toBeGreaterThanOrEqual(1);
  });

  it('renders RiskOverview when the overview tab is active and not viewing a task', () => {
    setMockPermissions({});
    setActiveTab('overview');

    render(<RiskPageClient {...defaultProps} />);

    expect(screen.getByTestId('risk-overview')).toBeInTheDocument();
  });

  it('renders charts when the risk-matrix tab is active', () => {
    setMockPermissions({});
    setActiveTab('risk-matrix');

    render(<RiskPageClient {...defaultProps} />);

    expect(screen.getByTestId('inherent-risk-chart')).toBeInTheDocument();
    expect(screen.getByTestId('residual-risk-chart')).toBeInTheDocument();
  });

  it('renders Comments when the comments tab is active', () => {
    setMockPermissions({});
    setActiveTab('comments');

    render(<RiskPageClient {...defaultProps} />);

    expect(screen.getByTestId('comments')).toBeInTheDocument();
  });

  it('hides RiskOverview when viewing a task item', () => {
    setMockPermissions(ADMIN_PERMISSIONS);

    render(<RiskPageClient {...defaultProps} taskItemId="task_item_1" />);

    expect(screen.queryByTestId('risk-overview')).not.toBeInTheDocument();
  });

  it('always renders TaskItems when viewing a task item', () => {
    setMockPermissions({});

    render(<RiskPageClient {...defaultProps} taskItemId="task_item_1" />);

    expect(screen.getByTestId('task-items')).toBeInTheDocument();
  });

  it('shows short task ID as title when viewing a task item', () => {
    setMockPermissions(ADMIN_PERMISSIONS);

    render(<RiskPageClient {...defaultProps} taskItemId="abc123def456" />);

    // shortTaskId takes last 6 chars, uppercased — falls back to 'Task'
    // since the mocked useTaskItems returns an empty list.
    expect(screen.getByRole('heading', { name: 'detail.taskFallback' })).toBeInTheDocument();
  });

  it('renders the breadcrumb regardless of user permissions', () => {
    setMockPermissions({});

    render(<RiskPageClient {...defaultProps} />);

    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
  });
});
