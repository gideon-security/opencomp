'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { IsmsDocument as IsmsDocumentData } from '../isms-types';
import { IsmsDocumentShell } from './IsmsDocumentShell';
import type { ApproverOption } from './IsmsApprovalSection';
import { ObjectivesTable } from './ObjectivesTable';
import type { ObjectiveFormValues } from './ObjectivesForm';
import type { ObjectiveRowUpdate } from './ObjectivesRow';

interface ObjectivesClientProps {
  organizationId: string;
  documentId: string;
  fallbackData: IsmsDocumentData | null;
  currentMemberId: string | null;
  approverOptions: ApproverOption[];
}

const OBJECTIVES_REGISTER = 'objectives' as const;

export function ObjectivesClient(props: ObjectivesClientProps) {
  const t = useTranslations('isms');

  return (
    <IsmsDocumentShell
      {...props}
      clause="6.2"
      title={t('objectives.title')}
      description={t('objectives.description')}
      sectionTitle={t('objectives.sectionTitle')}
      sectionDescription={t('objectives.sectionDescription')}
      generateSuccessMessage={t('objectives.generatedSuccess')}
    >
      {({ document, canManage, hook }) => {
        const handleCreate = async (values: ObjectiveFormValues) => {
          try {
            await hook.createRow({ register: OBJECTIVES_REGISTER, data: { ...values } });
            toast.success(t('objectives.objectiveAdded'));
          } catch (caught) {
            toast.error(
              caught instanceof Error ? caught.message : t('objectives.objectiveAddFailed'),
            );
            // Re-throw so the form keeps the user's input and stays open on failure.
            throw caught;
          }
        };

        const handleUpdate = async ({
          objectiveId,
          update,
        }: {
          objectiveId: string;
          update: ObjectiveRowUpdate;
        }) => {
          try {
            await hook.updateRow({
              register: OBJECTIVES_REGISTER,
              id: objectiveId,
              data: { ...update },
            });
            toast.success(t('objectives.objectiveUpdated'));
          } catch (caught) {
            toast.error(
              caught instanceof Error ? caught.message : t('objectives.objectiveUpdateFailed'),
            );
            // Re-throw so the row stays in edit mode with the user's changes on failure.
            throw caught;
          }
        };

        const handleDelete = async (objectiveId: string) => {
          try {
            await hook.deleteRow({ register: OBJECTIVES_REGISTER, id: objectiveId });
            toast.success(t('objectives.objectiveDeleted'));
          } catch (caught) {
            toast.error(
              caught instanceof Error ? caught.message : t('objectives.objectiveDeleteFailed'),
            );
            // Re-throw so the row's delete state resets only after a real outcome.
            throw caught;
          }
        };

        const objectives = Array.isArray(document.objectives) ? document.objectives : [];

        return (
          <ObjectivesTable
            objectives={objectives}
            canEdit={canManage}
            ownerOptions={props.approverOptions}
            onCreate={handleCreate}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        );
      }}
    </IsmsDocumentShell>
  );
}
