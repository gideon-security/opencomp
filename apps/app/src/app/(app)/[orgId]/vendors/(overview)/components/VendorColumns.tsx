import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { VendorStatus } from '@/components/vendor-status';
import { Avatar, AvatarFallback, AvatarImage } from '@gideon-defender/ui/avatar';
import { Badge } from '@gideon-defender/ui/badge';
import type { ColumnDef, Row } from '@tanstack/react-table';
import { Loader2, UserIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useVendorOnboardingStatus } from './vendor-onboarding-context';
import { VendorDeleteCell } from './VendorDeleteCell';
import type { VendorRow } from './VendorsTable';

function VendorNameCell({ row, orgId }: { row: Row<VendorRow>; orgId: string }) {
  const vendorId = row.original.id;
  const onboardingStatus = useVendorOnboardingStatus();
  const status = onboardingStatus[vendorId];
  const isPending = row.original.isPending || status === 'pending' || status === 'processing';
  const isAssessing = row.original.isAssessing || status === 'assessing';
  const isResearching = row.original.status === 'in_progress';
  const isResolved = row.original.status === 'assessed';
  const t = useTranslations('vendor');

  if ((isPending || isAssessing) && !isResolved) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground">{row.original.name}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Link href={`/${orgId}/vendors/${row.original.id}`}>{row.original.name}</Link>
      {isResearching && (
        <span className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
          </span>
          <span className="capitalize">{t('list.researching')}</span>
        </span>
      )}
    </div>
  );
}

function VendorStatusCell({ row }: { row: Row<VendorRow> }) {
  const vendorId = row.original.id;
  const onboardingStatus = useVendorOnboardingStatus();
  const status = onboardingStatus[vendorId];
  const isPending = row.original.isPending || status === 'pending' || status === 'processing';
  const isAssessing = row.original.isAssessing || status === 'assessing';
  const isResolved = row.original.status === 'assessed';
  const t = useTranslations('vendor');

  if (isPending && !isResolved) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground text-sm">{t('list.creating')}</span>
      </div>
    );
  }
  if (isAssessing && !isResolved) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground text-sm">{t('list.assessing')}</span>
      </div>
    );
  }
  if (row.original.status === 'in_progress') {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-primary text-sm">{t('list.researchingEllipsis')}</span>
      </div>
    );
  }
  return <VendorStatus status={row.original.status} />;
}

function categoryLabel(t: ReturnType<typeof useTranslations<'vendor'>>, category: string): string {
  switch (category) {
    case 'cloud':
      return t('list.categoryCloud');
    case 'infrastructure':
      return t('list.categoryInfrastructure');
    case 'software_as_a_service':
      return t('list.categorySaaS');
    case 'finance':
      return t('list.categoryFinance');
    case 'marketing':
      return t('list.categoryMarketing');
    case 'sales':
      return t('list.categorySales');
    case 'hr':
      return t('list.categoryHr');
    case 'other':
      return t('list.categoryOther');
    default:
      return category;
  }
}

export const columns = (
  orgId: string,
  t: ReturnType<typeof useTranslations<'vendor'>>,
  tCommon: ReturnType<typeof useTranslations<'overview'>>,
): ColumnDef<VendorRow>[] => [
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title={t('list.columnVendorName')} />;
    },
    cell: ({ row }) => {
      return <VendorNameCell row={row} orgId={orgId} />;
    },
    meta: {
      label: t('list.columnVendorName'),
      placeholder: t('list.searchForVendorName'),
      variant: 'text',
    },
    size: 250,
    minSize: 200,
    maxSize: 300,
    enableColumnFilter: true,
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title={tCommon('common.status')} />;
    },
    cell: ({ row }) => {
      return <VendorStatusCell row={row} />;
    },
    meta: {
      label: tCommon('common.status'),
      placeholder: t('list.searchByStatus'),
      variant: 'select',
    },
  },
  {
    id: 'category',
    accessorKey: 'category',
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title={t('create.category')} />;
    },
    cell: ({ row }) => {
      return (
        <Badge variant="marketing" className="w-fit">
          {categoryLabel(t, row.original.category)}
        </Badge>
      );
    },
    meta: {
      label: t('create.category'),
      placeholder: t('list.searchByCategory'),
      variant: 'select',
    },
  },
  {
    id: 'assignee',
    accessorKey: 'assignee',
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title={t('create.assignee')} />;
    },
    enableSorting: false,
    cell: ({ row }) => {
      // Handle null assignee
      if (!row.original.assignee) {
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
              src={row.original.assignee.user?.image || undefined}
              alt={row.original.assignee.user?.name || row.original.assignee.user?.email || ''}
            />
            <AvatarFallback>
              {row.original.assignee.user?.name?.charAt(0) ||
                row.original.assignee.user?.email?.charAt(0).toUpperCase() ||
                '?'}
            </AvatarFallback>
          </Avatar>
          <p className="text-sm font-medium">
            {row.original.assignee.user?.name ||
              row.original.assignee.user?.email ||
              t('list.unknownUser')}
          </p>
        </div>
      );
    },
    meta: {
      label: t('create.assignee'),
      placeholder: t('list.searchByAssignee'),
      variant: 'select',
    },
  },
  {
    id: 'delete-vendor',
    cell: ({ row }) => {
      return <VendorDeleteCell vendor={row.original} />;
    },
    enableSorting: false,
    enableHiding: false,
  },
];
