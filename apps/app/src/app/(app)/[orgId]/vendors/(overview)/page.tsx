import { AppOnboarding } from '@/components/app-onboarding';
import { serverApi } from '@/lib/api-server';
import { PageHeader, PageLayout } from '@trycompai/design-system';
import { getTranslations } from 'next-intl/server';
import { CreateVendorSheet } from '../components/create-vendor-sheet';
import { VendorsTable } from './components/VendorsTable';

interface VendorsApiResponse {
  data: Array<Record<string, unknown>>;
  count: number;
}

interface PeopleApiResponse {
  data: Array<{
    id: string;
    role: string;
    deactivated: boolean;
    user: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    };
  }>;
}

interface OnboardingApiResponse {
  triggerJobId: string | null;
}

export default async function Page({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const t = await getTranslations('vendor');

  const [vendorsResult, peopleResult, onboardingResult] = await Promise.all([
    serverApi.get<VendorsApiResponse>('/v1/vendors'),
    serverApi.get<PeopleApiResponse>('/v1/people'),
    serverApi.get<OnboardingApiResponse>('/v1/organization/onboarding'),
  ]);

  const vendors = vendorsResult.data?.data ?? [];
  const people = peopleResult.data?.data ?? [];
  const assignees = people
    .filter((p) => !p.deactivated && !['employee', 'contractor'].includes(p.role))
    .map((p) => ({
      id: p.id,
      role: p.role,
      user: p.user,
      organizationId: orgId,
      deactivated: false,
    }));

  // GET /v1/organization/onboarding returns { triggerJobId, ... } flat (no data wrapper)
  const onboardingRunId = onboardingResult.data?.triggerJobId ?? null;
  const isEmpty = vendors.length === 0;
  const isOnboardingActive = Boolean(onboardingRunId);

  // Show AppOnboarding only if empty AND onboarding is not active
  if (isEmpty && !isOnboardingActive) {
    return (
      <PageLayout
        header={
          <PageHeader
            title={t('list.title')}
            actions={<CreateVendorSheet assignees={assignees as any} organizationId={orgId} />}
          />
        }
      >
        <AppOnboarding
          title={t('list.onboardingTitle')}
          description={t('list.onboardingDescription')}
          cta={t('list.onboardingCta')}
          imageSrcLight="/onboarding/vendor-light.webp"
          imageSrcDark="/onboarding/vendor-dark.webp"
          imageAlt={t('list.imageAlt')}
          sheetName="createVendorSheet"
          faqs={[
            {
              questionKey: t('list.faq1Question'),
              answerKey: t('list.faq1Answer'),
            },
            {
              questionKey: t('list.faq2Question'),
              answerKey: t('list.faq2Answer'),
            },
            {
              questionKey: t('list.faq3Question'),
              answerKey: t('list.faq3Answer'),
            },
          ]}
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      header={
        <PageHeader
          title={t('list.title')}
          actions={<CreateVendorSheet assignees={assignees as any} organizationId={orgId} />}
        />
      }
    >
      <VendorsTable
        vendors={vendors as any}
        assignees={assignees as any}
        onboardingRunId={onboardingRunId}
        orgId={orgId}
      />
    </PageLayout>
  );
}
