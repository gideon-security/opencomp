'use client';

import { useMediaQuery } from '@gideon-defender/ui/hooks';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@trycompai/design-system';
import { useQueryState } from 'nuqs';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

export function CreateVendorTaskSheet() {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [queryOpen] = useQueryState('create-vendor-task-sheet');
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations('vendor');

  useEffect(() => {
    setIsOpen(Boolean(queryOpen));
  }, [queryOpen]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
  };

  const _handleSuccess = useCallback(() => {
    setIsOpen(false);
  }, []);

  if (isDesktop) {
    return (
      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t('task.createVendorTask')}</SheetTitle>
          </SheetHeader>
          <SheetBody>{/* <CreateVendorTaskForm assignees={assignees} onSuccess={handleSuccess} /> */}</SheetBody>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t('task.createVendorTask')}</DrawerTitle>
        </DrawerHeader>
        <div className="p-4">{/* <CreateVendorTaskForm assignees={assignees} onSuccess={handleSuccess} /> */}</div>
      </DrawerContent>
    </Drawer>
  );
}
