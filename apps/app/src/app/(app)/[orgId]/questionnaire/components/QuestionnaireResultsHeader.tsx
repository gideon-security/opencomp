'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@trycompai/design-system';
import { Flash, Search } from '@trycompai/design-system/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@gideon-defender/ui/dropdown-menu';
import { Button as CompButton } from '@gideon-defender/ui/button';
import {
  ChevronDown,
  Download,
  File,
  FileSpreadsheet,
  FileText as FileTextIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { QuestionAnswer } from './types';

interface QuestionnaireResultsHeaderProps {
  showExitDialog: boolean;
  onShowExitDialogChange: (show: boolean) => void;
  onExit: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filteredResults: QuestionAnswer[] | null;
  totalCount: number;
  answeredCount: number;
  progressPercentage: number;
  hasClickedAutoAnswer: boolean;
  results: QuestionAnswer[];
  isLoading: boolean;
  isAutoAnswering: boolean;
  isExporting: boolean;
  onAutoAnswer: () => void;
  onExport: (format: 'xlsx' | 'csv' | 'pdf') => void;
}

export function QuestionnaireResultsHeader({
  showExitDialog,
  onShowExitDialogChange,
  onExit,
  searchQuery,
  onSearchChange,
  totalCount,
  answeredCount,
  progressPercentage,
  isLoading,
  isAutoAnswering,
  isExporting,
  onAutoAnswer,
  onExport,
}: QuestionnaireResultsHeaderProps) {
  const t = useTranslations('questionnaire');
  const tCommon = useTranslations('overview');
  return (
    <>
      <div className="flex flex-col gap-4">
        <AlertDialog open={showExitDialog} onOpenChange={onShowExitDialogChange}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('results.exitTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('results.exitDescription')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tCommon('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={onExit}>
                {t('results.exitAndDiscard')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="grid grid-cols-3 gap-8">
          {/* Total Questions */}
          <div className="px-4 py-3.5 border-l-2 border-l-primary/40">
            <div className="text-muted-foreground mb-1 text-[10px] font-medium uppercase tracking-widest">
              {t('results.questions')}
            </div>
            <div className="text-foreground text-2xl font-semibold tabular-nums tracking-tight">
              {totalCount}
            </div>
          </div>

          {/* Answered */}
          <div className="px-4 py-3.5 border-l-2 border-l-emerald-500/40">
            <div className="text-muted-foreground mb-1 text-[10px] font-medium uppercase tracking-widest">
              {t('results.answered')}
            </div>
            <div className="text-foreground text-2xl font-semibold tabular-nums tracking-tight">
              {answeredCount}
            </div>
          </div>

          {/* Progress */}
          <div className="px-4 py-3.5 border-l-2 border-l-blue-500/40">
            <div className="text-muted-foreground mb-1 text-[10px] font-medium uppercase tracking-widest">
              {t('results.progress')}
            </div>
            <div className="text-foreground text-2xl font-semibold tabular-nums tracking-tight">
              {progressPercentage}%
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="w-80">
            <InputGroup>
              <InputGroupAddon>
                <Search size={16} />
              </InputGroupAddon>
              <InputGroupInput
                placeholder={t('results.searchQuestions')}
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </InputGroup>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onAutoAnswer();
              }}
              disabled={isAutoAnswering || isLoading}
              loading={isAutoAnswering}
              iconLeft={!isAutoAnswering ? <Flash size={16} /> : undefined}
            >
              {t('results.autoFillAll')}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <CompButton variant="outline" size="default" disabled={isExporting}>
                  <Download className="size-4" />
                  {t('results.export')}
                  <ChevronDown className="size-4" />
                </CompButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onExport('xlsx')} disabled={isExporting}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  {t('results.excel')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport('csv')} disabled={isExporting}>
                  <FileTextIcon className="mr-2 h-4 w-4" />
                  {t('results.csv')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport('pdf')} disabled={isExporting}>
                  <File className="mr-2 h-4 w-4" />
                  {t('results.pdf')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </>
  );
}
