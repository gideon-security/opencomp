'use client';

import { usePermissions } from '@/hooks/use-permissions';
import { useVendor, useVendorActions } from '@/hooks/use-vendors';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@trycompai/design-system';
import { Edit, OverflowMenuVertical, Renew } from '@trycompai/design-system/icons';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

interface VendorActionsProps {
  vendorId: string;
  onOpenEditSheet: () => void;
  onAssessmentTriggered?: (runId: string, publicAccessToken: string) => void;
}

export function VendorActions({
  vendorId,
  onOpenEditSheet,
  onAssessmentTriggered,
}: VendorActionsProps) {
  const { hasPermission } = usePermissions();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isAssessmentConfirmOpen, setIsAssessmentConfirmOpen] = useState(false);
  const [isAssessmentSubmitting, setIsAssessmentSubmitting] = useState(false);
  const t = useTranslations('vendor');
  const tCommon = useTranslations('overview');
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Get SWR mutate function to refresh vendor data after mutations
  const { mutate: refreshVendor } = useVendor(vendorId);
  const { triggerAssessment, regenerateMitigation } = useVendorActions();

  const handleConfirm = async () => {
    setIsConfirmOpen(false);
    setIsRegenerating(true);
    toast.info(t('detail.regeneratingVendorMitigation'));
    try {
      await regenerateMitigation(vendorId);
      toast.success(t('detail.regenerationTriggered'));
      refreshVendor();
    } catch {
      toast.error(t('detail.regenTriggerFailed'));
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleAssessmentConfirm = async () => {
    setIsAssessmentConfirmOpen(false);
    setIsAssessmentSubmitting(true);
    toast.info(t('detail.regeneratingVendorRisk'));
    try {
      const result = await triggerAssessment(vendorId);
      toast.success(t('detail.assessmentRegenerationTriggeredFull'));
      refreshVendor();
      // Notify parent with run info for real-time tracking
      if (result.runId && result.publicAccessToken) {
        onAssessmentTriggered?.(result.runId, result.publicAccessToken);
      }
    } catch {
      toast.error(t('detail.riskAssessmentRegenFailed'));
    } finally {
      setIsAssessmentSubmitting(false);
    }
  };

  if (!hasPermission('vendor', 'update')) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger variant="ellipsis">
          <OverflowMenuVertical />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onOpenEditSheet}>
            <Edit size={16} />
            {t('detail.edit')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsConfirmOpen(true)}>
            <Renew size={16} />
            {t('detail.mitigation')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsAssessmentConfirmOpen(true)}>
            <Renew size={16} />
            {t('detail.assessment')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('detail.regenerateMitigationDialog')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('detail.regenerateMitigationDialogDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRegenerating}>
              {tCommon('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isRegenerating}>
              {isRegenerating ? t('detail.working') : t('detail.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isAssessmentConfirmOpen} onOpenChange={setIsAssessmentConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('detail.regenerateAssessmentDialog')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('detail.regenerateAssessmentDialogDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isAssessmentSubmitting}>
              {tCommon('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAssessmentConfirm}
              disabled={isAssessmentSubmitting}
            >
              {isAssessmentSubmitting ? t('detail.working') : t('detail.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
