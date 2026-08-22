'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Stack,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@trycompai/design-system';
import { Search } from '@trycompai/design-system/icons';
import { apiClient } from '@/lib/api-client';
import { usePermissions } from '@/hooks/use-permissions';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Secret } from '../../hooks/useSecrets';
import { useSecrets } from '../../hooks/useSecrets';
import { EditSecretDialog } from '../EditSecretDialog';
import { SecretRow } from './SecretRow';

interface SecretsTableProps {
  initialSecrets: Secret[];
}

export function SecretsTable({ initialSecrets }: SecretsTableProps) {
  const t = useTranslations('settings');
  const { secrets, deleteSecret } = useSecrets({ initialData: initialSecrets });
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('secret', 'update');
  const canDelete = hasPermission('secret', 'delete');
  const canUpdate = canEdit || canDelete;

  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({});
  const [loadingSecrets, setLoadingSecrets] = useState<Record<string, boolean>>({});
  const [editingSecret, setEditingSecret] = useState<Secret | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [secretToDelete, setSecretToDelete] = useState<Secret | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const pageSizeOptions = [10, 25, 50, 100];

  const handleRevealSecret = async (secretId: string) => {
    if (revealedSecrets[secretId]) {
      setRevealedSecrets((prev) => {
        const next = { ...prev };
        delete next[secretId];
        return next;
      });
      return;
    }

    setLoadingSecrets((prev) => ({ ...prev, [secretId]: true }));

    try {
      const response = await apiClient.get<{ secret: { value: string } }>(
        `/v1/secrets/${secretId}`,
      );
      if (response.error || !response.data?.secret?.value) {
        throw new Error(response.error || 'Failed to fetch secret');
      }

      setRevealedSecrets((prev) => ({ ...prev, [secretId]: response.data!.secret.value }));
    } catch (error) {
      toast.error(t('secrets.table.revealFailed'));
      console.error('Error revealing secret:', error);
    } finally {
      setLoadingSecrets((prev) => ({ ...prev, [secretId]: false }));
    }
  };

  const handleCopySecret = (secretId: string) => {
    const value = revealedSecrets[secretId];
    if (value) {
      navigator.clipboard.writeText(value);
      toast.success(t('secrets.table.copied'));
    }
  };

  const handleDeleteClick = (secret: Secret) => {
    setSecretToDelete(secret);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!secretToDelete) return;

    setIsDeleting(true);
    try {
      await deleteSecret(secretToDelete.id);
      toast.success(t('secrets.table.deletedSuccess'));
      setDeleteDialogOpen(false);
      setSecretToDelete(null);
    } catch (error) {
      toast.error(t('secrets.table.deleteFailed'));
      console.error('Error deleting secret:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredSecrets = useMemo(() => {
    if (!searchQuery) return secrets;
    const query = searchQuery.toLowerCase();
    return secrets.filter(
      (secret) =>
        secret.name.toLowerCase().includes(query) ||
        secret.description?.toLowerCase().includes(query),
    );
  }, [secrets, searchQuery]);

  const pageCount = Math.max(1, Math.ceil(filteredSecrets.length / perPage));
  const paginatedSecrets = filteredSecrets.slice((page - 1) * perPage, page * perPage);

  const isEmpty = secrets.length === 0;
  const isSearchEmpty = filteredSecrets.length === 0 && searchQuery;

  return (
    <Stack gap="4">
      {/* Search Bar */}
      <div className="w-full md:max-w-[300px]">
        <InputGroup>
          <InputGroupAddon>
            <Search size={16} />
          </InputGroupAddon>
          <InputGroupInput
            placeholder={t('secrets.table.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
          />
        </InputGroup>
      </div>

      {/* Table */}
      {isEmpty || isSearchEmpty ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>
              {searchQuery
                ? t('secrets.table.notFoundTitle')
                : t('secrets.table.emptyTitle')}
            </EmptyTitle>
            <EmptyDescription>
              {searchQuery
                ? t('secrets.table.notFoundDescription')
                : t('secrets.table.emptyDescription')}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table
          variant="bordered"
          pagination={{
            page,
            pageCount,
            onPageChange: setPage,
            pageSize: perPage,
            pageSizeOptions,
            onPageSizeChange: (size) => {
              setPerPage(size);
              setPage(1);
            },
          }}
        >
          <TableHeader>
            <TableRow>
              <TableHead>{t('secrets.table.name')}</TableHead>
              <TableHead>{t('secrets.table.value')}</TableHead>
              <TableHead>{t('secrets.table.category')}</TableHead>
              <TableHead>{t('secrets.table.lastUsed')}</TableHead>
              <TableHead>{t('secrets.table.created')}</TableHead>
              {canUpdate && <TableHead>{t('secrets.table.actions')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedSecrets.map((secret) => (
              <SecretRow
                key={secret.id}
                secret={secret}
                revealedValue={revealedSecrets[secret.id]}
                isLoading={!!loadingSecrets[secret.id]}
                canEdit={canEdit}
                canDelete={canDelete}
                onReveal={handleRevealSecret}
                onCopy={handleCopySecret}
                onEdit={setEditingSecret}
                onDelete={handleDeleteClick}
              />
            ))}
          </TableBody>
        </Table>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('secrets.table.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('secrets.table.deleteDescription', { name: secretToDelete?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t('secrets.table.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? t('secrets.table.deleting') : t('secrets.table.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Secret Dialog */}
      {editingSecret && (
        <EditSecretDialog
          secret={editingSecret}
          open={!!editingSecret}
          onOpenChange={(open) => !open && setEditingSecret(null)}
        />
      )}
    </Stack>
  );
}
