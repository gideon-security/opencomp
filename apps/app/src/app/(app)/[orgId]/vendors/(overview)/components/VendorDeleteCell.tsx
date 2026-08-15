import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@gideon-defender/ui/alert-dialog';
import { Button } from '@gideon-defender/ui/button';
import { useVendorActions, type Vendor } from '@/hooks/use-vendors';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import { useSWRConfig } from 'swr';

interface VendorDeleteCellProps {
  vendor: Vendor;
}

export const VendorDeleteCell: React.FC<VendorDeleteCellProps> = ({ vendor }) => {
  const { deleteVendor } = useVendorActions();
  const { mutate } = useSWRConfig();
  const [isRemoveAlertOpen, setIsRemoveAlertOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const t = useTranslations('vendor');
  const tCommon = useTranslations('overview');

  const handleDeleteClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setIsDeleting(true);

    try {
      await deleteVendor(vendor.id);
      toast.success(t('list.deletedToast', { name: vendor.name }));
      setIsRemoveAlertOpen(false);
      mutate(
        (key) =>
          (Array.isArray(key) && key[0]?.includes('/v1/vendors')) ||
          (typeof key === 'string' && key.includes('/v1/vendors')),
        undefined,
        { revalidate: true },
      );
    } catch {
      toast.error(t('list.deleteFailedDot'));
    }

    setIsDeleting(false);
  };

  return (
    <>
      <div className="flex items-center justify-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            setIsRemoveAlertOpen(true);
          }}
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">{t('list.deleteTitle')} {vendor.name}</span>
        </Button>
      </div>
      <AlertDialog open={isRemoveAlertOpen} onOpenChange={setIsRemoveAlertOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('list.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('list.deleteConfirmation', { name: vendor.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteClick} disabled={isDeleting}>
              {isDeleting ? t('list.deleting') : tCommon('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
