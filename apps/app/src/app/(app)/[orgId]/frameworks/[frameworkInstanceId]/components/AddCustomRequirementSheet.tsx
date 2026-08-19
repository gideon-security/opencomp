'use client';

import { apiClient } from '@/lib/api-client';
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
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

export function AddCustomRequirementSheet({
  frameworkInstanceId,
}: {
  frameworkInstanceId: string;
}) {
  const { hasPermission } = usePermissions();
  const t = useTranslations('frameworks');
  const tCommon = useTranslations('overview');
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const schema = z.object({
    identifier: z.string().min(1, t('instance.identifierRequired')).max(80),
    name: z.string().min(1, t('instance.nameRequired')).max(200),
    description: z.string().max(4000),
  });

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: '', name: '', description: '' },
    mode: 'onChange',
  });

  useEffect(() => {
    if (!isOpen) {
      form.reset({ identifier: '', name: '', description: '' });
    }
  }, [isOpen, form]);

  if (!hasPermission('framework', 'update')) return null;

  const handleSubmit = async (values: FormValues) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const response = await apiClient.post(
        `/v1/frameworks/${frameworkInstanceId}/requirements`,
        values,
      );
      if (response.error) throw new Error(response.error);
      toast.success(t('instance.requirementAddedToast'));
      setIsOpen(false);
      form.reset();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('instance.addRequirementFailed'),
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
        {t('instance.addRequirementButton')}
      </Button>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t('instance.addCustomRequirementTitle')}</SheetTitle>
          </SheetHeader>
          <SheetBody>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="identifier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('instance.identifier')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t('instance.identifierPlaceholder')}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tCommon('common.name')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t('instance.namePlaceholder')}
                        />
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
                          placeholder={t('instance.describeRequirementPlaceholder')}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting}>
                    {t('instance.addRequirementButton')}
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
