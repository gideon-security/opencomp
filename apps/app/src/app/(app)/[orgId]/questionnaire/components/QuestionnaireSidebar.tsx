'use client';

import {
  FileSpreadsheet,
  FileText,
  FileText as FileTextIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

export function QuestionnaireSidebar() {
  const t = useTranslations('questionnaire');
  return (
    <div className="hidden lg:flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">
          {t('view.acceptedFiles')}
        </h4>
        <div className="flex flex-col gap-2">
          {[
            { icon: FileText, label: 'PDF', desc: t('view.pdfDesc') },
            { icon: FileSpreadsheet, label: 'Excel', desc: t('view.excelDesc') },
            { icon: FileTextIcon, label: 'CSV', desc: t('view.csvDesc') },
          ].map((format, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-2 rounded-xs hover:bg-muted/30 transition-colors"
            >
              <format.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">{format.label}</p>
                <p className="text-xs text-muted-foreground">{format.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 p-4 rounded-xs bg-muted/20">
        <p className="text-xs font-medium text-foreground">{t('view.quickTips')}</p>
        <ul className="text-xs text-muted-foreground space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span>{t('view.tip100mb')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span>{t('view.tipFormatted')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span>{t('view.tipTables')}</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

