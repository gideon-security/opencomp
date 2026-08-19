'use client';

import { TableHead, TableHeader, TableRow } from '@gideon-defender/ui/table';
import type { Table } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import type { RequirementTableData } from './ControlRequirementsTable';

type Props = {
  table: Table<RequirementTableData>;
  loading?: boolean;
};

export function ControlRequirementsTableHeader({ table, loading }: Props) {
  const t = useTranslations('controls');
  const tCommon = useTranslations('overview');
  const isVisible = (id: string) =>
    loading ||
    table
      .getAllLeafColumns()
      .find((col) => col.id === id)
      ?.getIsVisible();

  return (
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        {isVisible('type') && (
          <TableHead className="h-11 px-4 text-left align-middle font-medium">
            {t('columnType')}
          </TableHead>
        )}
        {isVisible('description') && (
          <TableHead className="h-11 px-4 text-left align-middle font-medium">
            {tCommon('common.description')}
          </TableHead>
        )}
        {isVisible('status') && (
          <TableHead className="h-11 px-4 text-left align-middle font-medium">
            {tCommon('common.status')}
          </TableHead>
        )}
      </TableRow>
    </TableHeader>
  );
}
