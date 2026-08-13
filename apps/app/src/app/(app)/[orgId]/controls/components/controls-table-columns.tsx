'use client';

import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { StatusIndicator } from '@/components/status-indicator';
import { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { ControlWithRelations } from '../data/queries';
import { getControlStatus } from '../lib/utils';

export function getControlColumns(
  t: ReturnType<typeof useTranslations<'controls'>>,
  tCommon: ReturnType<typeof useTranslations<'overview'>>,
): ColumnDef<ControlWithRelations>[] {
  return [
    {
      id: 'name',
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('controlName')} />,
      cell: ({ row }) => {
        return (
          <div className="flex items-center gap-2">
            <span className="max-w-[31.25rem] truncate font-medium">{row.getValue('name')}</span>
          </div>
        );
      },
      meta: {
        label: t('controlName'),
        placeholder: t('searchForAControl'),
        variant: 'text',
      },
      enableColumnFilter: true,
      filterFn: (row, id, value) => {
        return value.length === 0
          ? true
          : String(row.getValue(id)).toLowerCase().includes(String(value).toLowerCase());
      },
    },
    {
      id: 'status',
      accessorKey: '',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={tCommon('common.status')} />
      ),
      cell: ({ row }) => {
        const control = row.original;
        const status = getControlStatus(control);

        return <StatusIndicator status={status} />;
      },
      meta: {
        label: tCommon('common.status'),
        placeholder: t('searchStatus'),
        variant: 'text',
      },
      enableSorting: false,
    },
  ];
}
