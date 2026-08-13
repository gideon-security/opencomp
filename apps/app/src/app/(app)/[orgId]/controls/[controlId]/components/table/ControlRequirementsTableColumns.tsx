'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { CheckmarkFilled, Misuse } from '@trycompai/design-system/icons';
import { useTranslations } from 'next-intl';
import type { RequirementTableData } from './ControlRequirementsTable';

export function getControlRequirementsColumns(
  t: ReturnType<typeof useTranslations<'controls'>>,
  tCommon: ReturnType<typeof useTranslations<'overview'>>,
): ColumnDef<RequirementTableData>[] {
  return [
    {
      id: 'type',
      accessorKey: 'type',
      header: t('columnType'),
      cell: ({ row }) => {
        const requirement = row.original;
        return requirement.policy ? 'policy' : requirement.task ? 'task' : '';
      },
      size: 100,
    },
    {
      id: 'description',
      accessorKey: 'description',
      header: tCommon('common.description'),
      size: 1000,
      cell: ({ row }) => {
        const description = row.original.description || ''; // Default to empty string if null
        const maxLength = 300; // Increased character limit
        const displayText =
          description.length > maxLength ? `${description.substring(0, maxLength)}...` : description;

        return (
          <div className="w-full pr-4" title={description}>
            {displayText}
          </div>
        );
      },
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: tCommon('common.status'),
      size: 80,
      cell: ({ row }) => {
        const requirement = row.original;
        const isCompleted = requirement.policy
          ? requirement.policy?.status === 'published'
          : requirement.task
            ? requirement.task?.status === 'done' || requirement.task?.status === 'not_relevant'
            : false;

        return (
          <div className="flex items-center justify-center">
            {isCompleted ? (
              <CheckmarkFilled size={16} className="text-primary" />
            ) : (
              <Misuse size={16} className="text-red-500" />
            )}
          </div>
        );
      },
    },
  ];
}
