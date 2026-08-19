'use client';

import { Link } from '@trycompai/design-system/icons';
import { useTranslations } from 'next-intl';
import type { UseFormReturn } from 'react-hook-form';
import type { CreateRunForm } from './CreateRunPanel';

interface CreateRunTargetFieldsProps {
  form: UseFormReturn<CreateRunForm>;
}

export function CreateRunTargetFields({ form }: CreateRunTargetFieldsProps) {
  const t = useTranslations('security');

  return (
    <>
      <div className="mb-4">
        <label
          htmlFor="pt-target-url"
          className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground"
        >
          {t('penTest.targetFields.targetUrl')}
        </label>
        <div className="flex h-9 items-center gap-1.5 rounded border border-border bg-background px-3">
          <span className="shrink-0 font-mono text-xs text-muted-foreground">https://</span>
          <input
            id="pt-target-url"
            {...form.register('targetUrl')}
            placeholder="your.staging.app"
            autoFocus
            required
            className="min-w-0 flex-1 bg-transparent font-mono text-xs outline-none"
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {t('penTest.targetFields.targetHint')}
        </p>
      </div>

      <div className="mb-5">
        <label
          htmlFor="pt-repo-url"
          className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground"
        >
          <span>{t('penTest.targetFields.repository')}</span>
          <span className="font-normal normal-case tracking-normal text-muted-foreground">
            {t('penTest.targetFields.optional')}
          </span>
        </label>
        <div className="flex h-9 items-center gap-1.5 rounded border border-border bg-background px-3">
          <Link className="h-3 w-3 shrink-0 text-muted-foreground" />
          <input
            id="pt-repo-url"
            {...form.register('repoUrl')}
            placeholder="github.com/acme/platform"
            className="min-w-0 flex-1 bg-transparent font-mono text-xs outline-none"
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {t('penTest.targetFields.repoHint')}
        </p>
      </div>
    </>
  );
}
