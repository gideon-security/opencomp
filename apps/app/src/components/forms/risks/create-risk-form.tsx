'use client';

import { DepartmentSelect } from '@/components/DepartmentSelect';
import { SelectAssignee } from '@/components/SelectAssignee';
import { useRiskActions } from '@/hooks/use-risks';
import { Button } from '@gideon-defender/ui/button';
import type { Member, User } from '@db';
import { Departments, RiskCategory } from '@db';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  HStack,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SheetFooter,
  Textarea,
} from '@trycompai/design-system';
import { ArrowRight } from '@trycompai/design-system/icons';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useSWRConfig } from 'swr';
import { z } from 'zod';

interface CreateRiskProps {
  assignees: (Member & { user: User })[];
  onSuccess?: () => void;
}

export function CreateRisk({ assignees, onSuccess }: CreateRiskProps) {
  const { createRisk } = useRiskActions();
  const { mutate } = useSWRConfig();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = useTranslations('risk');
  const tCommon = useTranslations('overview');

  const schema = z.object({
    title: z
      .string({ error: t('create.nameRequired') })
      .min(1, { message: t('create.nameMinLength') })
      .max(100, { message: t('create.nameMaxLength') }),
    description: z
      .string({ error: t('create.descriptionRequired') })
      .min(1, { message: t('create.descriptionMinLength') })
      .max(255, { message: t('create.descriptionMaxLength') }),
    category: z.nativeEnum(RiskCategory, { error: t('create.categoryRequired') }),
    department: z
      .string({ error: t('create.departmentRequired') })
      .trim()
      .min(1, { message: t('create.departmentRequired') })
      .max(64, { message: t('create.departmentMaxLength') }),
    assigneeId: z.string().optional().nullable(),
  });

  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      category: RiskCategory.operations,
      department: Departments.admin,
      assigneeId: null,
    },
  });

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      await createRisk(data);
      toast.success(t('create.createdToast'));
      onSuccess?.();
      mutate((key) => Array.isArray(key) && key[0] === 'risks', undefined, { revalidate: true });
    } catch {
      toast.error(t('create.createFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="title">{t('create.riskTitle')}</FieldLabel>
          <Input
            id="title"
            {...register('title')}
            autoFocus
            placeholder={t('create.riskTitlePlaceholder')}
            autoCorrect="off"
          />
          <FieldError errors={[errors.title]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="description">{tCommon('common.description')}</FieldLabel>
          <Textarea
            id="description"
            {...register('description')}
            placeholder={t('create.descriptionPlaceholder')}
          />
          <FieldError errors={[errors.description]} />
        </Field>

        <Controller
          name="category"
          control={control}
          render={({ field }) => (
            <Field>
              <FieldLabel>{t('create.category')}</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t('create.selectCategory')} />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(RiskCategory).map((category) => {
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
              <FieldError errors={[errors.category]} />
            </Field>
          )}
        />

        <Controller
          name="department"
          control={control}
          render={({ field }) => (
            <Field>
              <FieldLabel>{t('create.department')}</FieldLabel>
              <DepartmentSelect
                value={field.value || ''}
                onChange={field.onChange}
                disabled={isSubmitting}
              />
              <FieldError errors={[errors.department]} />
            </Field>
          )}
        />

        <Controller
          name="assigneeId"
          control={control}
          render={({ field }) => (
            <Field>
              <FieldLabel>{t('create.assignee')}</FieldLabel>
              <SelectAssignee
                assigneeId={field.value ?? null}
                assignees={assignees}
                onAssigneeChange={field.onChange}
                disabled={isSubmitting}
                withTitle={false}
              />
              <FieldError errors={[errors.assigneeId]} />
            </Field>
          )}
        />
      </FieldGroup>

      <SheetFooter>
        <HStack justify="end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('create.creating') : t('create.create')}
            {!isSubmitting && <ArrowRight size={16} className="ml-2" />}
          </Button>
        </HStack>
      </SheetFooter>
    </form>
  );
}
