'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { IsmsDocument as IsmsDocumentData } from '../isms-types';
import { IsmsDocumentShell } from './IsmsDocumentShell';
import type { ApproverOption } from './IsmsApprovalSection';
import { RequirementsTable } from './RequirementsTable';
import type { RequirementFormValues } from './RequirementsForm';
import type { RequirementRowValues } from './RequirementsRow';

interface RequirementsClientProps {
  organizationId: string;
  documentId: string;
  fallbackData: IsmsDocumentData | null;
  currentMemberId: string | null;
  approverOptions: ApproverOption[];
}

const REGISTER = 'requirements' as const;

function toPayload(values: RequirementFormValues | RequirementRowValues) {
  return {
    partyName: values.partyName,
    interestedPartyId: values.interestedPartyId?.trim() ? values.interestedPartyId.trim() : null,
    requirement: values.requirement,
    treatment: values.treatment,
  };
}

export function RequirementsClient(props: RequirementsClientProps) {
  const t = useTranslations('isms');

  return (
    <IsmsDocumentShell
      {...props}
      clause="4.2"
      title={t('requirements.title')}
      description={t('requirements.description')}
      sectionTitle={t('requirements.sectionTitle')}
      sectionDescription={t('requirements.sectionDescription')}
      generateSuccessMessage={t('requirements.generatedSuccess')}
    >
      {({ document, canManage, hook }) => {
        const handleCreate = async (values: RequirementFormValues) => {
          try {
            await hook.createRow({ register: REGISTER, data: toPayload(values) });
            toast.success(t('requirements.requirementAdded'));
          } catch (caught) {
            toast.error(
              caught instanceof Error
                ? caught.message
                : t('requirements.requirementAddFailed'),
            );
            // Re-throw so the form keeps the user's input and stays open on failure.
            throw caught;
          }
        };

        const handleUpdate = async ({ id, values }: { id: string; values: RequirementRowValues }) => {
          try {
            await hook.updateRow({ register: REGISTER, id, data: toPayload(values) });
            toast.success(t('requirements.requirementUpdated'));
          } catch (caught) {
            toast.error(
              caught instanceof Error
                ? caught.message
                : t('requirements.requirementUpdateFailed'),
            );
            // Re-throw so the row stays in edit mode with the user's changes on failure.
            throw caught;
          }
        };

        const handleDelete = async (id: string) => {
          try {
            await hook.deleteRow({ register: REGISTER, id });
            toast.success(t('requirements.requirementDeleted'));
          } catch (caught) {
            toast.error(
              caught instanceof Error
                ? caught.message
                : t('requirements.requirementDeleteFailed'),
            );
            // Re-throw so the row's delete state resets only after a real outcome.
            throw caught;
          }
        };

        const requirements = Array.isArray(document.interestedPartyRequirements)
          ? document.interestedPartyRequirements
          : [];

        return (
          <RequirementsTable
            requirements={requirements}
            canEdit={canManage}
            onCreate={handleCreate}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        );
      }}
    </IsmsDocumentShell>
  );
}
