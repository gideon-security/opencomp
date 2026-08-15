import { getFeatureFlags } from '@/app/posthog';
import { AppOnboarding } from '@/components/app-onboarding';
import PageWithBreadcrumb from '@/components/pages/PageWithBreadcrumb';
import { serverApi } from '@/lib/api-server';
import { auth } from '@/utils/auth';
import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { QuestionnaireParser } from '../components/QuestionnaireParser';

interface PolicyApiResponse {
  data: Array<{
    id: string;
    status: string;
    isArchived: boolean;
  }>;
}

export default async function NewQuestionnairePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id || !session?.session?.activeOrganizationId) {
    return notFound();
  }
  const t = await getTranslations('questionnaire');

  const flags = await getFeatureFlags(session.user.id);
  const isFeatureEnabled = flags['ai-vendor-questionnaire'] === true;

  if (!isFeatureEnabled) {
    return notFound();
  }

  const organizationId = session.session.activeOrganizationId;

  const policiesResult = await serverApi.get<PolicyApiResponse>('/v1/policies');
  const policies = policiesResult.data?.data ?? [];
  const hasPublishedPolicies = policies.some(
    (p) => p.status === 'published' && !p.isArchived,
  );

  if (!hasPublishedPolicies) {
    return (
      <PageWithBreadcrumb
        breadcrumbs={[
          { label: t('tabs.title'), href: `/${organizationId}/questionnaire` },
          { label: t('overview.newQuestionnaire'), current: true },
        ]}
      >
        <AppOnboarding
          title={t('tabs.securityQuestionnaire')}
          description={t('tabs.onboardingDescription')}
          ctaDisabled={true}
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
      </PageWithBreadcrumb>
    );
  }

  return (
    <PageWithBreadcrumb
      breadcrumbs={[
        { label: t('tabs.securityQuestionnaire'), href: `/${organizationId}/questionnaire` },
        { label: t('overview.newQuestionnaire'), current: true },
      ]}
    >
      <QuestionnaireParser />
    </PageWithBreadcrumb>
  );
}
