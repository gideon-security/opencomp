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
  Text,
} from '@trycompai/design-system';
import { useTranslations } from 'next-intl';
import type { SyncHistoryItem } from '@/types/framework-versioning';

interface RollbackConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: SyncHistoryItem | null;
  isRollingBack: boolean;
  onConfirm: () => void;
}

export function RollbackConfirmDialog({
  open,
  onOpenChange,
  item,
  isRollingBack,
  onConfirm,
}: RollbackConfirmDialogProps) {
  const t = useTranslations('frameworks');
  const tCommon = useTranslations('overview');
  if (!item) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('instance.rollbackDialogTitle', {
              version: item.fromVersion.version,
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('instance.rollbackDialogDescription', {
              from: item.fromVersion.version,
              to: item.toVersion.version,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Text size="sm" variant="muted">
          {t('instance.rollbackDialogBlocked')}
        </Text>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRollingBack}>
            {tCommon('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isRollingBack}>
            {isRollingBack ? t('instance.rollingBack') : t('instance.confirmRollback')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
