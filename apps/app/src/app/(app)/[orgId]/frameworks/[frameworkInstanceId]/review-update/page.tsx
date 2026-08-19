import { serverApi } from '@/lib/api-server';
import { PageLayout } from '@trycompai/design-system';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import type { UpdatePreview } from '@/types/framework-versioning';
import { ReviewUpdateContent } from './components/ReviewUpdateContent';

interface PageProps {
  params: Promise<{
    orgId: string;
    frameworkInstanceId: string;
  }>;
}

export default async function ReviewUpdatePage({ params }: PageProps) {
  const { orgId, frameworkInstanceId } = await params;
  const t = await getTranslations('frameworks');

  const [frameworkRes, previewRes] = await Promise.all([
    serverApi.get<any>(`/v1/frameworks/${frameworkInstanceId}`),
    serverApi.get<{ data: UpdatePreview }>(
      `/v1/frameworks/${frameworkInstanceId}/update-preview`,
    ),
  ]);

  // No update available (latest version matches current) → bounce back.
  if (!frameworkRes.data || !previewRes.data?.data) {
    redirect(`/${orgId}/frameworks/${frameworkInstanceId}`);
  }

  const framework = frameworkRes.data;
  const frameworkName = framework.framework?.name ?? t('reviewUpdate.frameworkFallback');

  return (
    <PageLayout fillHeight>
      <ReviewUpdateContent
        orgId={orgId}
        frameworkInstanceId={frameworkInstanceId}
        frameworkName={frameworkName}
        initialPreview={previewRes.data.data}
      />
    </PageLayout>
  );
}
