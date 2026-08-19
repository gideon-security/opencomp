'use client';

import { Button } from '@gideon-defender/ui/button';
import { Textarea } from '@gideon-defender/ui/textarea';
import { BookOpen, ChevronDown, ChevronUp, Link as LinkIcon, Loader2, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { QuestionAnswer } from './types';
import { deduplicateSources } from '../utils/deduplicate-sources';
import { KnowledgeBaseDocumentLink } from './KnowledgeBaseDocumentLink';
import { ManualAnswerLink } from './ManualAnswerLink';

interface QuestionnaireResultsCardsProps {
  orgId: string;
  results: QuestionAnswer[];
  filteredResults: QuestionAnswer[];
  editingIndex: number | null;
  editingAnswer: string;
  onEditingAnswerChange: (answer: string) => void;
  expandedSources: Set<number>;
  questionStatuses: Map<number, 'pending' | 'processing' | 'completed'>;
  answeringQuestionIndex: number | null;
  answerQueue?: number[];
  isAutoAnswering: boolean;
  hasClickedAutoAnswer: boolean;
  isSaving?: boolean;
  savingIndex?: number | null;
  onEditAnswer: (index: number) => void;
  onSaveAnswer: (index: number) => void;
  onCancelEdit: () => void;
  onAnswerSingleQuestion: (index: number) => void;
  onToggleSource: (index: number) => void;
}

export function QuestionnaireResultsCards({
  orgId,
  results,
  filteredResults,
  editingIndex,
  editingAnswer,
  onEditingAnswerChange,
  expandedSources,
  questionStatuses,
  answeringQuestionIndex,
  answerQueue = [],
  isAutoAnswering,
  hasClickedAutoAnswer,
  isSaving,
  savingIndex,
  onEditAnswer,
  onSaveAnswer,
  onCancelEdit,
  onAnswerSingleQuestion,
  onToggleSource,
}: QuestionnaireResultsCardsProps) {
  const t = useTranslations('questionnaire');
  const tCommon = useTranslations('overview');
  return (
    <div className="lg:hidden space-y-4">
      {filteredResults.map((qa, index) => {
        // Use originalIndex if available (from detail page), otherwise find by question text
        const originalIndex = qa._originalIndex !== undefined 
          ? qa._originalIndex 
          : results.findIndex((r) => r.question === qa.question);
        // Fallback to index if not found (shouldn't happen, but safety check)
        const safeIndex = originalIndex >= 0 ? originalIndex : index;
        
        // Deduplicate sources for this question
        const uniqueSources = qa.sources ? deduplicateSources(qa.sources) : [];
        const isEditing = editingIndex === safeIndex;
        const questionStatus = questionStatuses.get(safeIndex);
        // Check if question is in queue (waiting to be processed)
        const isQueued = answerQueue.includes(safeIndex);
        // Determine if this question is being processed
        // It's processing if:
        // 1. Status is explicitly 'processing'
        // 2. This is the single question being answered
        // 3. Auto-answer is running and this question doesn't have an answer yet (or has empty answer)
        const isProcessing = 
          questionStatus === 'processing' || 
          answeringQuestionIndex === safeIndex ||
          (isAutoAnswering && hasClickedAutoAnswer && (!qa.answer || qa.answer.trim().length === 0) && questionStatus !== 'completed');

        return (
          <div
            key={`card-${safeIndex}-${qa.question.substring(0, 20)}`}
            className="flex flex-col gap-3 p-4 rounded-xs bg-muted/20 border border-border/30 animate-in fade-in duration-500 ease-out"
            style={{ 
              animationDelay: `${index * 50}ms`,
              animationFillMode: 'backwards'
            }}
          >
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                {t('results.questionLabel', { count: safeIndex + 1 })}
              </span>
              <p className="text-sm font-medium text-foreground">{qa.question}</p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">{t('results.answer')}</span>
              {isEditing ? (
                <div className="space-y-2">
                  <Textarea
                    value={editingAnswer}
                    onChange={(e) => onEditingAnswerChange(e.target.value)}
                    className="min-h-[80px]"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => onSaveAnswer(safeIndex)}
                      disabled={isSaving && savingIndex === safeIndex}
                    >
                      {isSaving && savingIndex === safeIndex ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t('results.saving')}
                        </>
                      ) : (
                        tCommon('common.save')
                      )}
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={onCancelEdit} 
                      variant="outline"
                      disabled={isSaving && savingIndex === safeIndex}
                    >
                      {tCommon('common.cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {qa.answer && qa.answer.trim().length > 0 ? (
                    <div
                      className="group relative rounded-xs p-3 bg-muted/30 border border-border/30 cursor-pointer transition-colors duration-150 ease-in-out hover:bg-muted/50 hover:border-primary/40"
                      onClick={() => onEditAnswer(safeIndex)}
                      title={t('results.clickToEdit')}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-foreground flex-1 leading-relaxed transition-colors duration-150 group-hover:text-foreground/90">{qa.answer}</p>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-70 transition-opacity duration-150 ease-in-out flex-shrink-0 mt-0.5" />
                      </div>
                    </div>
                  ) : isProcessing ? (
                    <div className="flex items-center gap-2 p-3 rounded-xs bg-muted/30 border border-border/30 min-h-[44px]">
                      <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                      <span className="text-sm text-muted-foreground">{t('results.findingAnswer')}</span>
                    </div>
                  ) : isQueued ? (
                    <div className="flex items-center gap-2 p-3 rounded-xs bg-muted/30 border border-border/30 min-h-[44px]">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                      <span className="text-sm text-muted-foreground">{t('results.findingAnswer')}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {!qa.failedToGenerate && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAnswerSingleQuestion(safeIndex);
                          }}
                          disabled={
                            answeringQuestionIndex === safeIndex ||
                            (isAutoAnswering && hasClickedAutoAnswer)
                          }
                          className="w-full justify-center"
                        >
                          {t('results.answer')}
                        </Button>
                      )}
                      {qa.failedToGenerate && (
                        <div className="p-2 rounded-xs bg-muted/30 border border-border/30">
                          <p className="text-xs text-muted-foreground text-center">
                            {t('results.insufficientInfo')}
                          </p>
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEditAnswer(safeIndex)}
                        className="w-full justify-center"
                      >
                        {t('results.writeAnswer')}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>

            {uniqueSources.length > 0 && (
              <div className="mt-3 pt-2 border-t border-border/30">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleSource(safeIndex)}
                  className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground w-full justify-start"
                >
                  <BookOpen className="mr-1 h-3 w-3" />
                  {expandedSources.has(safeIndex) ? (
                    <>
                      {t('results.hideSources', { count: uniqueSources.length })}
                      <ChevronUp className="ml-1 h-3 w-3" />
                    </>
                  ) : (
                    <>
                      {t('results.showSources', { count: uniqueSources.length })}
                      <ChevronDown className="ml-1 h-3 w-3" />
                    </>
                  )}
                </Button>
                {expandedSources.has(safeIndex) && (
                  <div className="mt-2 space-y-1 pl-4 border-l-2 border-muted/30">
                    {uniqueSources.map((source, sourceIndex) => {
                      const isPolicy = source.sourceType === 'policy' && source.sourceId;
                      const isKnowledgeBaseDocument =
                        source.sourceType === 'knowledge_base_document' && source.sourceId;
                      const isManualAnswer =
                        source.sourceType === 'manual_answer' && source.sourceId;
                      const sourceContent = source.sourceName || source.sourceType;

                      return (
                        <div key={sourceIndex} className="flex items-center gap-2 text-xs">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          {isPolicy ? (
                            <Link
                              href={`/${orgId}/policies/${source.sourceId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                            >
                              {sourceContent}
                              <LinkIcon className="h-3 w-3" />
                            </Link>
                          ) : isKnowledgeBaseDocument && source.sourceId ? (
                            <KnowledgeBaseDocumentLink
                              documentId={source.sourceId}
                              sourceName={sourceContent}
                              orgId={orgId}
                            />
                          ) : isManualAnswer && source.sourceId ? (
                            <ManualAnswerLink
                              manualAnswerId={source.sourceId}
                              sourceName={sourceContent}
                              orgId={orgId}
                            />
                          ) : (
                            <span className="font-medium text-muted-foreground">
                              {sourceContent}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
