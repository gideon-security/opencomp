import { render, screen } from '@testing-library/react';
import { mockNextIntl } from '@/test-utils/mocks/next-intl';
import { describe, expect, it, vi } from 'vitest';
import type { IsmsAudit, IsmsAuditControl } from '../isms-types';
import { ismsDesignSystemMock, ismsIconsMock, ismsSharedMock } from './__test-helpers__/dsMocks';

vi.mock('@trycompai/design-system', () => ismsDesignSystemMock());
vi.mock('@trycompai/design-system/icons', () => ismsIconsMock());

// The add-card mock renders the open state (formTitle + form) so the nested
// AddControlForm's labels are reachable without driving the collapse toggle.
vi.mock('./shared', () => ({
  ...ismsSharedMock(),
  IsmsAddCard: ({
    addLabel,
    formTitle,
    children,
  }: {
    addLabel: string;
    formTitle: string;
    children: (helpers: { close: () => void }) => React.ReactNode;
  }) => (
    <div>
      <button type="button">{addLabel}</button>
      <h4>{formTitle}</h4>
      {children({ close: () => {} })}
    </div>
  ),
}));

// The row editor owns its own editing UI; the table only needs to render one.
vi.mock('./AuditControlRow', () => ({
  AuditControlRow: ({ control }: { control: IsmsAuditControl }) => (
    <tr>
      <td>{control.controlRef}</td>
    </tr>
  ),
}));

import { AuditControlsTable } from './AuditControlsTable';

mockNextIntl();

const CONTROL: IsmsAuditControl = {
  id: 'ctl-row-1',
  auditId: 'aud-1',
  controlKey: null,
  controlRef: 'A.5.1',
  whatWasTested: 'The information security policy',
  whereToFind: 'OpenComp > Policies',
  notes: null,
  result: 'not_sampled',
  source: 'manual',
  derivedFrom: null,
  position: 0,
};

function makeAudit(controls: IsmsAuditControl[]): IsmsAudit {
  return {
    id: 'aud-1',
    reference: 'IA-2026-01',
    controls,
    findings: [],
    status: 'planned',
    scope: '',
    criteria: '',
    auditorName: null,
    plannedStartDate: null,
    plannedEndDate: null,
    conclusionVerdict: null,
    conclusionNotes: null,
    signoffAuditorName: null,
    signoffAuditorDate: null,
    signoffSpoName: null,
    signoffSpoDate: null,
    signoffTopMgmtName: null,
    signoffTopMgmtDate: null,
    position: 0,
  } as IsmsAudit;
}

const noop = vi.fn().mockResolvedValue(undefined);

describe('AuditControlsTable', () => {
  it('renders the heading and description keys', () => {
    render(
      <AuditControlsTable
        audit={makeAudit([CONTROL])}
        canEdit={false}
        onCreateControl={noop}
        onUpdateControl={noop}
        onDeleteControl={noop}
      />,
    );

    expect(screen.getByText('auditControls.title')).toBeInTheDocument();
    expect(screen.getByText('auditControls.description')).toBeInTheDocument();
  });

  it('renders every sampled control row', () => {
    render(
      <AuditControlsTable
        audit={makeAudit([CONTROL])}
        canEdit={false}
        onCreateControl={noop}
        onUpdateControl={noop}
        onDeleteControl={noop}
      />,
    );

    expect(screen.getByText('A.5.1')).toBeInTheDocument();
    expect(screen.queryByText('auditControls.empty')).not.toBeInTheDocument();
  });

  it('shows the empty message when no controls are recorded', () => {
    render(
      <AuditControlsTable
        audit={makeAudit([])}
        canEdit={false}
        onCreateControl={noop}
        onUpdateControl={noop}
        onDeleteControl={noop}
      />,
    );

    expect(screen.getByText('auditControls.empty')).toBeInTheDocument();
  });

  it('renders the column headers', () => {
    render(
      <AuditControlsTable
        audit={makeAudit([CONTROL])}
        canEdit={false}
        onCreateControl={noop}
        onUpdateControl={noop}
        onDeleteControl={noop}
      />,
    );

    expect(screen.getByText('auditControls.columns.controlRef')).toBeInTheDocument();
    expect(screen.getByText('auditControls.columns.whatWasTested')).toBeInTheDocument();
    expect(screen.getByText('auditControls.columns.whereToFind')).toBeInTheDocument();
    expect(screen.getByText('auditControls.columns.result')).toBeInTheDocument();
    expect(screen.getByText('auditControls.columns.notes')).toBeInTheDocument();
  });

  it('offers the add-control card to editors with the translated labels', () => {
    render(
      <AuditControlsTable
        audit={makeAudit([CONTROL])}
        canEdit
        onCreateControl={noop}
        onUpdateControl={noop}
        onDeleteControl={noop}
      />,
    );

    // The add-card trigger and the form submit button share the label.
    expect(screen.getAllByText('auditControls.addRow').length).toBeGreaterThan(0);
    expect(screen.getByText('auditControls.newFormTitle')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('auditControls.form.controlRefPlaceholder')).toBeInTheDocument();
  });

  it('hides the add-control card and actions column from read-only users', () => {
    render(
      <AuditControlsTable
        audit={makeAudit([CONTROL])}
        canEdit={false}
        onCreateControl={noop}
        onUpdateControl={noop}
        onDeleteControl={noop}
      />,
    );

    expect(screen.queryByText('auditControls.addRow')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('auditControls.actions')).not.toBeInTheDocument();
  });

  it('exposes an accessible actions column header for editors', () => {
    render(
      <AuditControlsTable
        audit={makeAudit([CONTROL])}
        canEdit
        onCreateControl={noop}
        onUpdateControl={noop}
        onDeleteControl={noop}
      />,
    );

    expect(screen.getByLabelText('auditControls.actions')).toBeInTheDocument();
  });
});
