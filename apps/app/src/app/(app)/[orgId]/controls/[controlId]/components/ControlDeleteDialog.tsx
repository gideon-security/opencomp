'use client';

import { Button } from '@gideon-defender/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@gideon-defender/ui/dialog';
import { Form } from '@gideon-defender/ui/form';
import { Control } from '@db';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useControls } from '../../hooks/useControls';
import { usePermissions } from '@/hooks/use-permissions';

const formSchema = z.object({
  comment: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ControlDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  control: Control;
}

export function ControlDeleteDialog({ isOpen, onClose, control }: ControlDeleteDialogProps) {
  const { deleteControl } = useControls();
  const { hasPermission } = usePermissions();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = useTranslations('controls');
  const tCommon = useTranslations('overview');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      comment: '',
    },
  });

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await deleteControl(control.id);
      toast.info(t('controlDeletedRedirecting'));
      onClose();
      router.push(`/${control.organizationId}/controls`);
    } catch {
      toast.error(t('controlDeleteFailed'));
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('deleteControl')}</DialogTitle>
          <DialogDescription>{t('deleteConfirmation')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                {tCommon('common.cancel')}
              </Button>
              <Button type="submit" variant="destructive" disabled={isSubmitting || !hasPermission('control', 'delete')} className="gap-2">
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    {t('deleting')}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Trash2 className="h-3 w-3" />
                    {tCommon('common.delete')}
                  </span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
