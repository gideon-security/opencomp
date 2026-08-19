import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { StatusIndicator } from '@/components/status-indicator';
import { Avatar, AvatarFallback, AvatarImage } from '@gideon-defender/ui/avatar';
import { Badge } from '@gideon-defender/ui/badge';
import type { ColumnDef } from '@tanstack/react-table';
import { Loader2, UserIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { RiskListTranslator, RiskRow } from '../../RisksTable';
import { useRiskOnboardingStatus } from '../risk-onboarding-context';

export const columns = (
  orgId: string,
  t: RiskListTranslator,
  tCommon: ReturnType<typeof useTranslations<'overview'>>,
): ColumnDef<RiskRow>[] => [
  {
    id: 'title',
    accessorKey: 'title',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('list.columnRisk')} />,
    cell: ({ row }) => {
      return <RiskNameCell row={row} orgId={orgId} />;
    },
    meta: {
      label: t('list.columnRisk'),
      placeholder: t('list.searchForARisk'),
      variant: 'text',
    },
    size: 250,
    minSize: 200,
    maxSize: 300,
    enableColumnFilter: true,
    enableSorting: true,
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={tCommon('common.status')} />
    ),
    cell: ({ row }) => {
      return <RiskStatusCell row={row} t={t} />;
    },
    meta: {
      label: tCommon('common.status'),
    },
    enableColumnFilter: true,
    enableSorting: true,
  },
  {
    id: 'department',
    accessorKey: 'department',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('list.columnDepartment')} />
    ),
    cell: ({ row }) => {
      return (
        <Badge variant="marketing" className="w-fit uppercase">
          {row.original.department}
        </Badge>
      );
    },
    meta: {
      label: t('list.columnDepartment'),
    },
    enableColumnFilter: true,
    enableSorting: true,
  },
  {
    id: 'assignee',
    accessorKey: 'assignee.user.name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('list.columnAssignee')} />
    ),
    enableSorting: false,
    cell: ({ row }) => {
      const user = row.original.assignee?.user;
      if (!user) {
        return (
          <div className="flex items-center gap-2">
            <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
              <UserIcon className="text-muted-foreground h-4 w-4" />
            </div>
            <p className="text-muted-foreground text-sm font-medium">{tCommon('common.none')}</p>
          </div>
        );
      }

      return (
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={user.image || undefined}
              alt={user.name || user.email || ''}
            />
            <AvatarFallback>
              {user.name?.charAt(0) ||
                user.email?.charAt(0).toUpperCase() ||
                '?'}
            </AvatarFallback>
          </Avatar>
          <p className="text-sm font-medium">
            {user.name || user.email}
          </p>
        </div>
      );
    },
    meta: {
      label: t('list.columnAssignee'),
    },
    enableColumnFilter: true,
  },
];

function RiskNameCell({ row, orgId }: { row: { original: RiskRow }; orgId: string }) {
  const risk = row.original;
  const status = useRiskOnboardingStatus(risk.id);
  const isPending = risk.isPending;
  // Don't show active status if risk is already closed (mitigated)
  const isResolved = risk.status === 'closed';
  const isActive =
    !isResolved &&
    (status === 'pending' ||
      status === 'processing' ||
      status === 'created' ||
      status === 'assessing');

  if (isPending || isActive) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="line-clamp-1 capitalize">{risk.title}</span>
      </div>
    );
  }

  return (
    <Link href={`/${orgId}/risk/${risk.id}`}>
      <span className="line-clamp-1 capitalize">{risk.title}</span>
    </Link>
  );
}

function RiskStatusCell({ row, t }: { row: { original: RiskRow }; t: RiskListTranslator }) {
  const risk = row.original;
  const status = useRiskOnboardingStatus(risk.id);
  const isPending = risk.isPending;
  const isResolved = risk.status === 'closed';
  // Don't show assessing if risk is already resolved
  const isAssessing = !isResolved && (risk.isAssessing || status === 'assessing');
  const isActive =
    !isResolved &&
    (status === 'pending' ||
      status === 'processing' ||
      status === 'created' ||
      status === 'assessing');

  if (isPending || isActive) {
    const statusText =
      status === 'pending' || status === 'processing' || isPending
        ? t('list.statusCreating')
        : status === 'assessing' || isAssessing
          ? t('list.statusAssessing')
          : t('list.statusProcessing');

    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-muted-foreground text-sm">{statusText}</span>
      </div>
    );
  }

  return <StatusIndicator status={risk.status} />;
}
