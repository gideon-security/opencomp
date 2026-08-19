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
  Stack,
  Text,
} from '@trycompai/design-system';
import { useTranslations } from 'next-intl';
import type { UpdatePreview } from '@/types/framework-versioning';

interface SyncConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: UpdatePreview;
  isSyncing: boolean;
  onConfirm: () => void;
}

function countChanges(preview: UpdatePreview): {
  added: number;
  archived: number;
  updated: number;
  linkChanges: number;
} {
  const added =
    preview.controls.added.length +
    preview.tasks.added.length +
    preview.policies.added.length +
    preview.requirements.added.length;

  const archived =
    preview.controls.archived.length +
    preview.tasks.archived.length +
    preview.policies.archived.length +
    preview.requirements.removed.length;

  const updated =
    preview.controls.updatedApplied.length +
    preview.tasks.updatedApplied.length +
    preview.policies.updatedApplied.length +
    preview.requirements.updated.length;

  // Edge-level changes (control↔policy/task/requirement/document-type) are
  // real sync impact too; without this the summary can read "no changes"
  // even though sync will rewire links.
  const linkChanges =
    preview.edges.controlPolicy.added.length +
    preview.edges.controlPolicy.removed.length +
    preview.edges.controlTask.added.length +
    preview.edges.controlTask.removed.length +
    preview.edges.controlRequirement.added.length +
    preview.edges.controlRequirement.removed.length +
    preview.edges.controlDocumentType.added.length +
    preview.edges.controlDocumentType.removed.length;

  return { added, archived, updated, linkChanges };
}

export function SyncConfirmDialog({
  open,
  onOpenChange,
  preview,
  isSyncing,
  onConfirm,
}: SyncConfirmDialogProps) {
  const t = useTranslations('frameworks');
  const tCommon = useTranslations('overview');
  const { added, archived, updated, linkChanges } = countChanges(preview);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('instance.syncDialogTitle', {
              version: preview.toVersion.version,
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('instance.syncDialogDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Stack gap="2">
          {added > 0 && (
            <Text size="sm">
              {t.rich('instance.changesWillBeAdded', {
                count: added,
                b: (chunks) => <span className="font-medium">{chunks}</span>,
              })}
            </Text>
          )}
          {archived > 0 && (
            <Text size="sm">
              {t.rich('instance.changesWillBeArchived', {
                count: archived,
                b: (chunks) => <span className="font-medium">{chunks}</span>,
              })}
            </Text>
          )}
          {updated > 0 && (
            <Text size="sm">
              {t.rich('instance.changesWillBeUpdated', {
                count: updated,
                b: (chunks) => <span className="font-medium">{chunks}</span>,
              })}
            </Text>
          )}
          {linkChanges > 0 && (
            <Text size="sm">
              {t.rich('instance.changesLinksRewired', {
                count: linkChanges,
                b: (chunks) => <span className="font-medium">{chunks}</span>,
              })}
            </Text>
          )}
          {preview.controls.updatedPreserved.length > 0 && (
            <Text size="sm" variant="muted">
              {t.rich('instance.controlEditsPreserved', {
                count: preview.controls.updatedPreserved.length,
                b: (chunks) => <span className="font-medium">{chunks}</span>,
              })}
            </Text>
          )}
        </Stack>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSyncing}>
            {tCommon('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isSyncing}>
            {isSyncing ? t('instance.syncing') : t('instance.confirmSync')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
