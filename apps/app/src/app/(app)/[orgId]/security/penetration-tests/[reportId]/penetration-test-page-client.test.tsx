import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PenetrationTestPageClient } from './penetration-test-page-client';

vi.mock('../_components/SplitView', () => ({
  SplitView: ({ orgId, selectedRunId }: { orgId: string; selectedRunId: string }) => (
    <div data-testid="split-view" data-org-id={orgId} data-selected-run-id={selectedRunId} />
  ),
}));

describe('PenetrationTestPageClient', () => {
  it('renders SplitView with the org and selected report as props', () => {
    render(<PenetrationTestPageClient orgId="org_1" reportId="report_1" />);

    const splitView = screen.getByTestId('split-view');
    expect(splitView).toHaveAttribute('data-org-id', 'org_1');
    expect(splitView).toHaveAttribute('data-selected-run-id', 'report_1');
  });
});
