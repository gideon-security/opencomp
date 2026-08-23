import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PermissionErrorPanel } from './PermissionErrorPanel';

describe('PermissionErrorPanel provider detection', () => {
  it('detects Azure errors referencing management.azure.com as a host token', () => {
    render(
      <PermissionErrorPanel
        error="AuthorizationFailed: Permission denied for scope https://management.azure.com/subscriptions/x"
        fixScript="az role assignment create"
      />,
    );
    expect(screen.getByText(/role assignment changes in azure may take/i)).toBeInTheDocument();
    expect(screen.queryByText(/iam changes in gcp may take/i)).not.toBeInTheDocument();
  });

  it('does not treat a lookalike hostname suffix as Azure', () => {
    render(
      <PermissionErrorPanel
        error="not authorized to perform: sts:AssumeRole because token came from management.azure.com.evil.com"
        apiCalls={['sts:AssumeRole']}
      />,
    );
    expect(screen.getByText(/propagate in aws/i)).toBeInTheDocument();
    expect(screen.queryByText(/role assignment changes in azure/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/iam changes in gcp/i)).not.toBeInTheDocument();
  });

  it('detects GCP errors referencing googleapis.com as a host token', () => {
    render(
      <PermissionErrorPanel
        error="Permission denied when calling googleapis.com endpoints"
        fixScript="gcloud projects add-iam-policy-binding"
      />,
    );
    expect(screen.getByText(/iam changes in gcp may take/i)).toBeInTheDocument();
    expect(screen.queryByText(/role assignment changes in azure/i)).not.toBeInTheDocument();
  });

  it('does not treat a lookalike hostname suffix as GCP', () => {
    render(
      <PermissionErrorPanel
        error="AccessDenied: request to storage.googleapis.com.attacker.example rejected"
        apiCalls={['s3:ListBucket']}
      />,
    );
    expect(screen.getByText(/propagate in aws/i)).toBeInTheDocument();
    expect(screen.queryByText(/iam changes in gcp/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/role assignment changes in azure/i)).not.toBeInTheDocument();
  });
});
