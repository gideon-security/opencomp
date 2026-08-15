import { AppOnboarding } from '@/components/app-onboarding';
import { serverApi } from '@/lib/api-server';
import { SecondaryMenu } from '@gideon-defender/ui/secondary-menu';
import type { Member, User } from '@db';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { CreateVendorSheet } from '../components/create-vendor-sheet';

interface VendorsResponse {
  data: unknown[];
  count: number;
}

interface PeopleResponse {
  data: (Member & { user: User })[];
}

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const t = await getTranslations('vendor');

  const [vendorsRes, membersRes] = await Promise.all([
    serverApi.get<VendorsResponse>('/v1/vendors'),
    serverApi.get<PeopleResponse>('/v1/people'),
  ]);

  const vendorCount = vendorsRes.data?.count ?? 0;
  const allMembers = Array.isArray(membersRes.data?.data)
    ? membersRes.data.data
    : [];
  const assignees = allMembers.filter(
    (m) =>
      !m.deactivated &&
      !m.role.includes('employee') &&
      !m.role.includes('contractor'),
  );

  if (vendorCount === 0) {
    return (
      <div className="m-auto max-w-[1200px]">
        <Suspense fallback={<div>Loading...</div>}>
          <div className="mt-8">
            <AppOnboarding
              title={t('list.onboardingTitle')}
              description={t('list.onboardingDescriptionBackup')}
              cta={t('list.onboardingCta')}
              imageSrcDark="/onboarding/vendor-management.webp"
              imageSrcLight="/onboarding/vendor-management-light.webp"
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
            {orgId && <CreateVendorSheet assignees={assignees} organizationId={orgId} />}
          </div>
        </Suspense>
      </div>
    );
  }

  return (
    <div className="m-auto max-w-[1200px]">
      <Suspense fallback={<div>Loading...</div>}>
        <SecondaryMenu
          items={[
            { path: `/${orgId}/vendors`, label: 'Overview' },
            { path: `/${orgId}/vendors/register`, label: 'Vendors' },
          ]}
        />
        <div>{children}</div>
      </Suspense>
    </div>
  );
}
