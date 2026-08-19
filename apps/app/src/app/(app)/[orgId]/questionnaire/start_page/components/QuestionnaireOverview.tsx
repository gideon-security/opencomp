'use client';

import { Card, CardContent } from '@gideon-defender/ui';
import { Button } from '@gideon-defender/ui/button';
import { FileText, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { QuestionnaireListItem } from '../../components/types';
import { QuestionnaireHistory } from './QuestionnaireHistory';

interface QuestionnaireOverviewProps {
  questionnaires: QuestionnaireListItem[];
}

export function QuestionnaireOverview({ questionnaires }: QuestionnaireOverviewProps) {
  const params = useParams();
  const orgId = params.orgId as string;
  const t = useTranslations('questionnaire');

  return (
    <div className="flex flex-col gap-8">
      {/* New Questionnaire Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <div className="flex flex-col items-center gap-3">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-lg font-semibold text-foreground">{t('overview.answerNewQuestionnaire')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('overview.answerNewDescription')}
                </p>
              </div>
            </div>
            <Button size="lg" asChild>
              <Link href={`/${orgId}/questionnaire/new_questionnaire`}>
                <Plus className="mr-2 h-4 w-4" />
                {t('overview.newQuestionnaire')}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* History Section */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t('overview.history')}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('overview.historyDescription')}
          </p>
        </div>
        <QuestionnaireHistory questionnaires={questionnaires} orgId={orgId} />
      </div>
    </div>
  );
}
