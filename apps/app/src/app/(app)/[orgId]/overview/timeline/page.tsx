import { serverApi } from '@/lib/api-server';
import { PageHeader, PageLayout } from '@trycompai/design-system';
import { getTranslations } from 'next-intl/server';
import { OverviewTabs } from '../components/OverviewTabs';
import { TimelineOverview } from '../components/TimelineOverview';
import type { Timeline } from '@/hooks/use-timelines';

export async function generateMetadata() {
  const t = await getTranslations('overview');
  return { title: t('timeline.title') };
}

export default async function TimelinePage() {
  const t = await getTranslations('overview');
  const timelinesRes = await serverApi.get<{ data: Timeline[]; count: number }>(
    '/v1/timelines',
  );
  const timelines = timelinesRes.data?.data ?? [];

  return (
    <PageLayout header={<PageHeader title={t('timeline.overviewTitle')} tabs={<OverviewTabs />} />}>
      <TimelineOverview initialData={timelines} />
    </PageLayout>
  );
}
