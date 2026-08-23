import { CompanySubmissionWizard } from '@/app/(app)/[orgId]/documents/components/CompanySubmissionWizard';
import { formFieldLabel } from '@/app/(app)/[orgId]/documents/form-description-labels';
import { conciseFormDescriptions } from '@/app/(app)/[orgId]/documents/form-descriptions';
import { Breadcrumb, PageHeader, PageLayout, Text } from '@trycompai/design-system';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { evidenceFormDefinitions, evidenceFormTypeSchema } from '../../forms';

export default async function NewCompanySubmissionPage({
  params,
}: {
  params: Promise<{ orgId: string; formType: string }>;
}) {
  const { orgId, formType } = await params;
  const parsedType = evidenceFormTypeSchema.safeParse(formType);

  if (!parsedType.success) {
    notFound();
  }

  const parsedFormType = parsedType.data;
  const formDefinition = evidenceFormDefinitions[parsedFormType];
  const t = await getTranslations('isms');

  return (
    <PageLayout>
      <Breadcrumb
        items={[
          {
            label: 'Documents',
            href: `/${orgId}/documents`,
            props: { render: <Link href={`/${orgId}/documents`} /> },
          },
          {
            label: formDefinition.title,
            href: `/${orgId}/documents/${parsedFormType}`,
            props: { render: <Link href={`/${orgId}/documents/${parsedFormType}`} /> },
          },
          { label: 'New Submission', isCurrent: true },
        ]}
      />
      <PageHeader title={`New ${formDefinition.title} Submission`} />
      <div className="space-y-6">
        <Text variant="muted">
          {conciseFormDescriptions[parsedFormType]
            ? formFieldLabel(t, parsedFormType)
            : formDefinition.description}
        </Text>
        <CompanySubmissionWizard organizationId={orgId} formType={parsedFormType} />
      </div>
    </PageLayout>
  );
}
