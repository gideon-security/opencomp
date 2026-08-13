import { getTranslations } from 'next-intl/server';
import { FindingsPage } from './FindingsPage';

export async function generateMetadata() {
  const t = await getTranslations('overview');
  return { title: t('findings.metaTitle') };
}

export default async function Page({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  return <FindingsPage orgId={orgId} />;
}
