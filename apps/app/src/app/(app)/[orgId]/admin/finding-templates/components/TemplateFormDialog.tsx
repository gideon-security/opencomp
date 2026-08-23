'use client';

import {
  useAdminFindingTemplates,
  type FindingTemplate,
} from '@/hooks/use-admin-finding-templates';
import { api } from '@/lib/api-client';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Stack,
  Text,
  Textarea,
} from '@trycompai/design-system';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  FINDING_TEMPLATE_CATEGORIES,
  findingTemplateCategoryLabel,
} from './constants';

type AdminTranslator = ReturnType<typeof useTranslations<'admin'>>;

function createTemplateSchema(t: AdminTranslator) {
  return z.object({
    category: z.string().min(1, t('findingTemplates.form.validation.categoryRequired')),
    title: z.string().min(1, t('findingTemplates.form.validation.titleRequired')).max(500),
    content: z.string().min(1, t('findingTemplates.form.validation.contentRequired')).max(50000),
    order: z.number().int().min(0),
  });
}

type TemplateFormValues = z.infer<ReturnType<typeof createTemplateSchema>>;

interface TemplateFormDialogProps {
  open: boolean;
  template: FindingTemplate | null;
  onClose: () => void;
}

const emptyDefaults: TemplateFormValues = {
  category: FINDING_TEMPLATE_CATEGORIES[0],
  title: '',
  content: '',
  order: 0,
};

export function TemplateFormDialog({ open, template, onClose }: TemplateFormDialogProps) {
  const t = useTranslations('admin');
  const { mutate } = useAdminFindingTemplates();
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(template);

  const templateSchema = useMemo(() => createTemplateSchema(t), [t]);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: emptyDefaults,
  });

  // Populate the form whenever it opens (create -> blank, edit -> template).
  useEffect(() => {
    if (!open) return;
    reset(
      template
        ? {
            category: template.category,
            title: template.title,
            content: template.content,
            order: template.order,
          }
        : emptyDefaults,
    );
  }, [open, template, reset]);

  const handleSave = async (values: TemplateFormValues) => {
    setSaving(true);
    const res = isEdit
      ? await api.patch(`/v1/finding-template/${template!.id}`, values)
      : await api.post('/v1/finding-template', values);
    setSaving(false);

    if (res.error) {
      toast.error(res.error);
      return;
    }

    toast.success(
      isEdit
        ? t('findingTemplates.form.toastUpdated')
        : t('findingTemplates.form.toastCreated'),
    );
    mutate();
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {isEdit
              ? t('findingTemplates.form.editTitle')
              : t('findingTemplates.form.newTitle')}
          </SheetTitle>
        </SheetHeader>
        <SheetBody>
          <form onSubmit={handleSubmit(handleSave)}>
            <Stack gap="md">
              <div className="flex flex-col gap-1.5">
                <Label>{t('findingTemplates.form.category')}</Label>
                <Controller
                  control={control}
                  name="category"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('findingTemplates.form.categoryPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {FINDING_TEMPLATE_CATEGORIES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {findingTemplateCategoryLabel(t, value)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.category && (
                  <Text size="xs" variant="destructive">
                    {errors.category.message}
                  </Text>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ft-title">{t('findingTemplates.form.titleLabel')}</Label>
                <Input
                  id="ft-title"
                  {...register('title')}
                  placeholder={t('findingTemplates.form.titlePlaceholder')}
                />
                {errors.title && (
                  <Text size="xs" variant="destructive">
                    {errors.title.message}
                  </Text>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ft-content">{t('findingTemplates.form.contentLabel')}</Label>
                <Textarea
                  id="ft-content"
                  rows={6}
                  {...register('content')}
                  placeholder={t('findingTemplates.form.contentPlaceholder')}
                />
                {errors.content && (
                  <Text size="xs" variant="destructive">
                    {errors.content.message}
                  </Text>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ft-order">{t('findingTemplates.form.orderLabel')}</Label>
                <Input
                  id="ft-order"
                  type="number"
                  min={0}
                  {...register('order', { valueAsNumber: true })}
                />
                {errors.order && (
                  <Text size="xs" variant="destructive">
                    {errors.order.message}
                  </Text>
                )}
              </div>

              <Button type="submit" loading={saving}>
                {isEdit
                  ? t('findingTemplates.form.saveChanges')
                  : t('findingTemplates.form.create')}
              </Button>
            </Stack>
          </form>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
