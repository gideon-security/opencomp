import { mockNextIntl } from '@/test-utils/mocks/next-intl';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AwsAccountSettingsBody } from './aws-account-settings-body';

const state = vi.hoisted(() => ({
  connection: null as unknown,
  isLoading: false,
}));

vi.mock('@/hooks/use-integration-platform', () => ({
  useIntegrationConnection: () => ({
    connection: state.connection,
    isLoading: state.isLoading,
  }),
  useIntegrationMutations: () => ({
    updateConnectionCredentials: vi.fn(),
    updateConnectionMetadata: vi.fn(),
    deleteConnection: vi.fn(),
  }),
}));

vi.mock('@/components/integrations/CloudShellSetup', () => ({
  CloudShellSetup: ({
    disabled,
    disabledMessage,
  }: {
    disabled?: boolean;
    disabledMessage?: string;
  }) => (
    <div
      data-testid="cloud-shell-setup"
      data-disabled={disabled ? 'true' : 'false'}
      data-disabled-message={disabledMessage ?? ''}
    />
  ),
}));

vi.mock('@/components/integrations/CredentialInput', () => ({
  CredentialInput: () => <div data-testid="credential-input" />,
}));

vi.mock('@gideon-defender/integration-platform', () => ({
  getAwsCloudShellUrl: () => 'https://console.aws.amazon.com/cloudshell',
  getAwsRemediationScript: () => '',
  normalizeAwsEnvironment: (value: unknown) => (value === 'aws-us-gov' ? 'aws-us-gov' : 'aws'),
  parseRemediationRolesMap: () => ({}),
}));

vi.mock('@gideon-defender/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@trycompai/design-system', () => ({
  Button: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}));

vi.mock('lucide-react', () => ({
  AlertTriangle: () => <span data-testid="alert-icon" />,
  CheckCircle2: () => <span data-testid="check-icon" />,
  Loader2: () => <span data-testid="loader-icon" />,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('./remediation-roles-table', () => ({
  RemediationRolesTable: () => <div data-testid="remediation-roles-table" />,
}));

mockNextIntl();

const provider = {
  credentialFields: [{ id: 'regions', label: 'Regions', type: 'multi-select', options: [] }],
} as never;

function renderBody() {
  render(<AwsAccountSettingsBody open connectionId="conn_aws" provider={provider} orgId="org_1" />);
}

describe('AwsAccountSettingsBody externalId display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.isLoading = false;
    state.connection = null;
  });

  it('shows the server-minted externalId from metadata, never the org id', () => {
    state.connection = {
      id: 'conn_aws',
      status: 'active',
      createdAt: new Date().toISOString(),
      metadata: {
        connectionName: 'Prod',
        accountId: '123456789012',
        externalId: 'org_org_1_issued',
      },
    };
    renderBody();

    expect(screen.getByText('org_org_1_issued')).toBeInTheDocument();
    expect(screen.queryByText('org_1')).not.toBeInTheDocument();
  });

  it('shows an em dash when no externalId is on file (legacy connection)', () => {
    state.connection = {
      id: 'conn_legacy',
      status: 'active',
      createdAt: new Date().toISOString(),
      metadata: { connectionName: 'Legacy' },
    };
    renderBody();

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('disables the setup script with guidance when no externalId is on file', () => {
    state.connection = {
      id: 'conn_legacy',
      status: 'active',
      createdAt: new Date().toISOString(),
      metadata: { connectionName: 'Legacy' },
    };
    renderBody();

    const setup = screen.getByTestId('cloud-shell-setup');
    expect(setup).toHaveAttribute('data-disabled', 'true');
    expect(setup.getAttribute('data-disabled-message')).toContain('reconnect');
  });

  it('enables the setup script when the server-minted externalId is on file', () => {
    state.connection = {
      id: 'conn_aws',
      status: 'active',
      createdAt: new Date().toISOString(),
      metadata: {
        connectionName: 'Prod',
        accountId: '123456789012',
        externalId: 'org_org_1_issued',
      },
    };
    renderBody();

    expect(screen.getByTestId('cloud-shell-setup')).toHaveAttribute('data-disabled', 'false');
  });
});
