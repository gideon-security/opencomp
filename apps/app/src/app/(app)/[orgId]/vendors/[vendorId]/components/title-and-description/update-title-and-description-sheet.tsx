'use client';

import { useMediaQuery } from '@gideon-defender/ui/hooks';
import type { Vendor } from '@db';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@trycompai/design-system';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

import { UpdateTitleAndDescriptionForm } from './update-title-and-description-form';

interface UpdateTitleAndDescriptionSheetProps {
  vendor: Vendor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpdateTitleAndDescriptionSheet({
  vendor,
  open,
  onOpenChange,
}: UpdateTitleAndDescriptionSheetProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const t = useTranslations('vendor');

  const handleSuccess = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  if (isDesktop) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t('create.updateVendor')}</SheetTitle>
            <SheetDescription>{t('create.updateVendorDescription')}</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <UpdateTitleAndDescriptionForm vendor={vendor} onSuccess={handleSuccess} />
          </SheetBody>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t('create.updateVendor')}</DrawerTitle>
        </DrawerHeader>
        <div className="p-4">
          <UpdateTitleAndDescriptionForm vendor={vendor} onSuccess={handleSuccess} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
