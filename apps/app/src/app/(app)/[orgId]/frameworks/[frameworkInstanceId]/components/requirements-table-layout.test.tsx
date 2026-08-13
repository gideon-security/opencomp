import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mockNextIntl } from '@/test-utils/mocks/next-intl';
import {
  REQUIREMENTS_TABLE_COLUMN_COUNT,
  REQUIREMENTS_TABLE_STYLE,
  RequirementsTableColumnGroup,
  RequirementsTableHeader,
} from './requirements-table-layout';

mockNextIntl();

describe('requirements table layout', () => {
  it('defines a compact column for every visible requirement field', () => {
    const { container } = render(
      <table>
        <RequirementsTableColumnGroup />
        <RequirementsTableHeader />
      </table>,
    );

    expect(container.querySelectorAll('col')).toHaveLength(REQUIREMENTS_TABLE_COLUMN_COUNT);
    expect(screen.getByRole('columnheader', { name: 'controlsTable.columnIdentifier' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'controlsTable.columnDescription' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'controlsTable.columnControls' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'controlsTable.columnCompliance' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'controlsTable.columnStatus' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'controlsTable.columnDocs' })).toHaveAttribute(
      'title',
      'controlsTable.columnDocuments',
    );
    expect(REQUIREMENTS_TABLE_STYLE).toMatchObject({ tableLayout: 'fixed' });
  });
});
