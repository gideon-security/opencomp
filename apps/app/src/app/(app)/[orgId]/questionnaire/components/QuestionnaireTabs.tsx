'use client';

import { AppOnboarding } from '@/components/app-onboarding';
import {
  PageHeader,
  PageLayout,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@trycompai/design-system';
import { AdditionalDocumentsSection } from '../knowledge-base/additional-documents/components';
import { KnowledgeBaseHeader } from '../knowledge-base/components/KnowledgeBaseHeader';
import { ContextSection } from '../knowledge-base/context/components';
import { ManualAnswersSection } from '../knowledge-base/manual-answers/components';
import { PublishedPoliciesSection } from '../knowledge-base/published-policies/components';
import { QuestionnaireOverview } from '../start_page/components';
import { useTranslations } from 'next-intl';
import type {
  ContextEntry,
  KBDocument,
  ManualAnswer,
  PublishedPolicy,
  QuestionnaireListItem,
} from './types';

interface QuestionnaireTabsProps {
  organizationId: string;
  // Questionnaires tab
  questionnaires: QuestionnaireListItem[];
  hasPublishedPolicies: boolean;
  // Knowledge Base tab
  policies: PublishedPolicy[];
  contextEntries: ContextEntry[];
  manualAnswers: ManualAnswer[];
  documents: KBDocument[];
}

export function QuestionnaireTabs({
  organizationId,
  questionnaires,
  hasPublishedPolicies,
  policies,
  contextEntries,
  manualAnswers,
  documents,
}: QuestionnaireTabsProps) {
  const t = useTranslations('questionnaire');
  // Show onboarding if no published policies exist
  if (!hasPublishedPolicies) {
    return (
      <PageLayout header={<PageHeader title={t('tabs.title')} />}>
        <AppOnboarding
          title={t('tabs.securityQuestionnaire')}
          description={t('tabs.onboardingDescription')}
          ctaDisabled={false}
          cta={t('tabs.publishPolicies')}
          ctaTooltip={t('tabs.publishPoliciesTooltip')}
          href={`/${organizationId}/policies`}
          imageSrcLight="/questionaire/tmp-questionaire-empty-state.png"
          imageSrcDark="/questionaire/tmp-questionaire-empty-state.png"
          imageAlt={t('tabs.imageAlt')}
          faqs={[
            {
              questionKey: t('tabs.faq1Question'),
              answerKey: t('tabs.faq1Answer'),
            },
            {
              questionKey: t('tabs.faq2Question'),
              answerKey: t('tabs.faq2Answer'),
            },
            {
              questionKey: t('tabs.faq3Question'),
              answerKey: t('tabs.faq3Answer'),
            },
          ]}
        />
      </PageLayout>
    );
  }

  return (
    <Tabs defaultValue="questionnaires">
      <PageLayout
        header={
          <PageHeader
            title={t('tabs.title')}
            tabs={
              <TabsList variant="underline">
                <TabsTrigger value="questionnaires">{t('tabs.securityQuestionnaire')}</TabsTrigger>
                <TabsTrigger value="knowledge-base">{t('tabs.knowledgeBase')}</TabsTrigger>
              </TabsList>
            }
          />
        }
      >
        {/* Questionnaires Tab */}
        <TabsContent value="questionnaires">
          <QuestionnaireOverview questionnaires={questionnaires} />
        </TabsContent>

        {/* Knowledge Base Tab */}
        <TabsContent value="knowledge-base">
          <KnowledgeBaseHeader organizationId={organizationId} />
          <div className="mt-6 flex flex-col gap-6">
            {/* Published Policies and Context Sections - Side by Side */}
            <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
              <PublishedPoliciesSection policies={policies} />
              <ContextSection contextEntries={contextEntries} />
            </div>
            {/* Manual Answers Section */}
            <ManualAnswersSection manualAnswers={manualAnswers} />
            {/* Additional Documents Section */}
            <AdditionalDocumentsSection organizationId={organizationId} documents={documents} />
          </div>
        </TabsContent>
      </PageLayout>
    </Tabs>
  );
}
