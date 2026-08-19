'use client';

import { useVendorActions } from '@/hooks/use-vendors';
import { Button } from '@gideon-defender/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@gideon-defender/ui/form';
import { VendorCategory, VendorStatus, type Vendor } from '@db';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input, Stack, Textarea } from '@trycompai/design-system';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useSWRConfig } from 'swr';
import { z } from 'zod';

interface UpdateTitleAndDescriptionFormProps {
  vendor: Vendor;
  onSuccess?: () => void;
}

export function UpdateTitleAndDescriptionForm({
  vendor,
  onSuccess,
}: UpdateTitleAndDescriptionFormProps) {
  const { updateVendor } = useVendorActions();
  const { mutate: globalMutate } = useSWRConfig();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = useTranslations('vendor');
  const tCommon = useTranslations('overview');

  const updateVendorSchema = z.object({
    id: z.string(),
    name: z.string().min(1, t('create.nameRequired')),
    description: z.string().optional(),
    category: z.nativeEnum(VendorCategory),
    status: z.nativeEnum(VendorStatus),
    assigneeId: z.string().nullable(),
    website: z
      .union([z.string().url(t('create.urlInvalid')), z.literal('')])
      .optional(),
    isSubProcessor: z.boolean().optional(),
  });

  type FormValues = z.infer<typeof updateVendorSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(updateVendorSchema),
    defaultValues: {
      id: vendor.id,
      name: vendor.name,
      description: vendor.description,
      category: vendor.category,
      status: vendor.status,
      assigneeId: vendor.assigneeId,
      website: vendor.website ?? '',
    },
  });

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      await updateVendor(data.id, {
        name: data.name,
        description: data.description,
        category: data.category,
        status: data.status,
        assigneeId: data.assigneeId,
        website: data.website === '' ? undefined : data.website,
      });

      toast.success(t('create.vendorUpdated'));
      globalMutate(
        (key) =>
          (Array.isArray(key) && key[0]?.includes('/v1/vendors')) ||
          (typeof key === 'string' && key.includes('/v1/vendors')),
        undefined,
        { revalidate: true },
      );
      onSuccess?.();
    } catch {
      toast.error(t('create.vendorUpdateFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Stack gap="4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{tCommon('common.name')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    autoFocus
                    placeholder={t('create.vendorNamePlaceholder')}
                    autoCorrect="off"
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
                    value={field.value ?? ''}
                    placeholder={t('create.vendorDescriptionPlaceholder')}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('create.website')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    placeholder={t('create.websitePlaceholder')}
                    autoCorrect="off"
                    inputMode="url"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('create.saving') : tCommon('common.save')}
            </Button>
          </div>
        </Stack>
      </form>
    </Form>
  );
}
