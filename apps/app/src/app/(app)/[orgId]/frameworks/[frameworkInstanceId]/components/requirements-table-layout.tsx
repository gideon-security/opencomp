'use client';

import { TableHead, TableHeader, TableRow } from '@trycompai/design-system';
import { useTranslations } from 'next-intl';
import type { CSSProperties } from 'react';

interface RequirementsTableColumn {
  id: string;
  label: string;
  title?: string;
  width: string;
}

const REQUIREMENTS_TABLE_COLUMNS = [
  { id: 'identifier', label: 'controlsTable.columnIdentifier', width: '10%' },
  { id: 'name', label: 'controlsTable.columnName', width: '19%' },
  { id: 'description', label: 'controlsTable.columnDescription', width: '22%' },
  { id: 'compliance', label: 'controlsTable.columnCompliance', width: '13%' },
  { id: 'status', label: 'controlsTable.columnStatus', width: '11%' },
  { id: 'controls', label: 'controlsTable.columnControls', width: '7%' },
  { id: 'policies', label: 'controlsTable.columnPolicies', width: '6.5%' },
  { id: 'tasks', label: 'controlsTable.columnTasks', width: '5.5%' },
  { id: 'documents', label: 'controlsTable.columnDocs', title: 'controlsTable.columnDocuments', width: '6%' },
] as const satisfies readonly RequirementsTableColumn[];

export const REQUIREMENTS_TABLE_COLUMN_COUNT = REQUIREMENTS_TABLE_COLUMNS.length;

export const REQUIREMENTS_TABLE_STYLE: CSSProperties = {
  tableLayout: 'fixed',
};

export function RequirementsTableColumnGroup() {
  return (
    <colgroup>
      {REQUIREMENTS_TABLE_COLUMNS.map((column) => (
        <col key={column.id} style={{ width: column.width }} />
      ))}
    </colgroup>
  );
}

export function RequirementsTableHeader() {
  const t = useTranslations('frameworks');
  return (
    <TableHeader>
      <TableRow>
        {REQUIREMENTS_TABLE_COLUMNS.map((column) => (
          <TableHead
            key={column.id}
            style={{ width: column.width }}
            title={'title' in column ? t(column.title) : undefined}
          >
            {t(column.label)}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}
