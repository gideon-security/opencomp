'use client';

import { useControls } from '@/app/(app)/[orgId]/controls/hooks/useControls';
import { usePermissions } from '@/hooks/use-permissions';
import {
  Button,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@trycompai/design-system';
import { Add } from '@trycompai/design-system/icons';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@gideon-defender/ui/form';
import { Input } from '@gideon-defender/ui/input';
import { Textarea } from '@gideon-defender/ui/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

type FormValues = {
  name: string;
  description: string;
};

export function AddCustomControlSheet({
  frameworkInstanceId,
  requirementId,
  isCustomRequirement,
}: {
  frameworkInstanceId: string;
  requirementId: string;
  isCustomRequirement: boolean;
}) {
  const { hasPermission } = usePermissions();
  const { createControl } = useControls();
  const router = useRouter();
  const t = useTranslations('frameworks');
  const tCommon = useTranslations('overview');
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(1, t('requirements.nameRequired')).max(200),
        description: z
          .string()
          .min(1, t('requirements.descriptionRequired'))
          .max(4000),
      }),
    [t],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
    mode: 'onChange',
  });

  if (!hasPermission('control', 'create')) return null;

  const handleSubmit = async (values: FormValues) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await createControl({
        name: values.name,
        description: values.description,
        requirementMappings: [
          isCustomRequirement
            ? { customRequirementId: requirementId, frameworkInstanceId }
            : { requirementId, frameworkInstanceId },
        ],
      });
      toast.success(t('requirements.controlCreated'));
      setIsOpen(false);
      form.reset();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('requirements.controlCreateFailed'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        iconLeft={<Add size={16} />}
        onClick={() => setIsOpen(true)}
      >
        {t('requirements.addControlButton')}
      </Button>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t('requirements.addCustomControlTitle')}</SheetTitle>
          </SheetHeader>
          <SheetBody>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tCommon('common.name')}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder={t('requirements.controlNamePlaceholder')} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tCommon('common.description')}</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          className="min-h-[120px]"
                          placeholder={t('requirements.controlDescriptionPlaceholder')}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting}>
                    {t('requirements.addControlButton')}
                  </Button>
                </div>
              </form>
            </Form>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </>
  );
}
