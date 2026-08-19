'use client';

import { SelectAssignee } from '@/components/SelectAssignee';
import { VENDOR_STATUS_TYPES, VendorStatus } from '@/components/vendor-status';
import { useVendorActions } from '@/hooks/use-vendors';
import { Button } from '@gideon-defender/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@gideon-defender/ui/form';
import { Input } from '@gideon-defender/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@gideon-defender/ui/select';
import { Member, type User, type Vendor, VendorCategory, VendorStatus as VendorStatusEnum } from '@db';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

export function UpdateSecondaryFieldsForm({
  vendor,
  assignees,
  onUpdate,
}: {
  vendor: Vendor;
  assignees: (Member & { user: User })[];
  onUpdate?: () => void;
}) {
  const { updateVendor } = useVendorActions();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = useTranslations('vendor');
  const tCommon = useTranslations('overview');

  const updateVendorSchema = z.object({
    id: z.string(),
    name: z.string().min(1, t('create.nameRequired')),
    description: z.string().optional(),
    category: z.nativeEnum(VendorCategory),
    status: z.nativeEnum(VendorStatusEnum),
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
      assigneeId: vendor.assigneeId,
      category: vendor.category,
      status: vendor.status,
      website: vendor.website ?? '',
      isSubProcessor: vendor.isSubProcessor,
    },
  });

  const onSubmit = async (data: FormValues) => {
    // Explicitly set assigneeId to null if it's an empty string (representing "None")
    const finalAssigneeId = data.assigneeId === '' ? null : data.assigneeId;

    setIsSubmitting(true);
    try {
      await updateVendor(data.id, {
        name: data.name,
        description: data.description,
        assigneeId: finalAssigneeId,
        category: data.category,
        status: data.status,
        website: data.website,
        isSubProcessor: data.isSubProcessor,
      });
      toast.success(t('create.vendorUpdated'));
      onUpdate?.();
    } catch {
      toast.error(t('create.vendorUpdateFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="assigneeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('create.assignee')}</FormLabel>
                <FormControl>
                  <SelectAssignee
                    disabled={isSubmitting}
                    withTitle={false}
                    assignees={assignees}
                    assigneeId={field.value}
                    onAssigneeChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('create.status')}</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('create.selectStatus')}>
                        {field.value && <VendorStatus status={field.value} />}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(VENDOR_STATUS_TYPES).map((status) => (
                        <SelectItem key={status} value={status}>
                          <VendorStatus status={status} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('create.category')}</FormLabel>
                <FormControl>
                  <Select {...field} value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('create.selectCategory')} />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(VendorCategory).map((category) => {
                        const formattedCategory = category
                          .toLowerCase()
                          .split('_')
                          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(' ');
                        return (
                          <SelectItem key={category} value={category}>
                            {formattedCategory}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
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
                    placeholder={t('create.websitePlaceholder')}
                    disabled={isSubmitting}
                    type="url"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="submit" variant="default" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : tCommon('common.save')}
          </Button>
        </div>
      </form>
    </Form>
  );
}
