'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { IsmsDocument as IsmsDocumentData } from '../isms-types';
import { InterestedPartiesTable } from './InterestedPartiesTable';
import { IsmsDocumentShell } from './IsmsDocumentShell';
import type { ApproverOption } from './IsmsApprovalSection';

interface InterestedPartiesClientProps {
  organizationId: string;
  documentId: string;
  fallbackData: IsmsDocumentData | null;
  currentMemberId: string | null;
  approverOptions: ApproverOption[];
}

const REGISTER = 'interested-parties' as const;

export function InterestedPartiesClient(props: InterestedPartiesClientProps) {
  const t = useTranslations('isms');

  return (
    <IsmsDocumentShell
      {...props}
      clause="4.2"
      title={t('interestedParties.title')}
      description={t('interestedParties.description')}
      sectionTitle={t('interestedParties.sectionTitle')}
      sectionDescription={t('interestedParties.sectionDescription')}
      generateSuccessMessage={t('interestedParties.generatedSuccess')}
    >
      {({ document, canManage, hook }) => {
        const handleCreateParty = async (input: {
          name: string;
          category: string;
          needsExpectations: string;
        }) => {
          try {
            await hook.createRow({ register: REGISTER, data: { ...input } });
            toast.success(t('interestedParties.partyAdded'));
          } catch (caught) {
            toast.error(
              caught instanceof Error
                ? caught.message
                : t('interestedParties.partyAddFailed'),
            );
            // Re-throw so the form keeps the user's input and stays open on failure.
            throw caught;
          }
        };

        const handleUpdateParty = async (params: {
          partyId: string;
          input: { name: string; category: string; needsExpectations: string };
        }) => {
          try {
            await hook.updateRow({ register: REGISTER, id: params.partyId, data: { ...params.input } });
            toast.success(t('interestedParties.partyUpdated'));
          } catch (caught) {
            toast.error(
              caught instanceof Error
                ? caught.message
                : t('interestedParties.partyUpdateFailed'),
            );
            // Re-throw so the row stays in edit mode with the user's changes on failure.
            throw caught;
          }
        };

        const handleDeleteParty = async (partyId: string) => {
          try {
            await hook.deleteRow({ register: REGISTER, id: partyId });
            toast.success(t('interestedParties.partyDeleted'));
          } catch (caught) {
            toast.error(
              caught instanceof Error
                ? caught.message
                : t('interestedParties.partyDeleteFailed'),
            );
            // Re-throw so the row's delete state resets only after a real outcome.
            throw caught;
          }
        };

        const parties = Array.isArray(document.interestedParties) ? document.interestedParties : [];

        return (
          <InterestedPartiesTable
            parties={parties}
            canEdit={canManage}
            onCreate={handleCreateParty}
            onUpdate={handleUpdateParty}
            onDelete={handleDeleteParty}
          />
        );
      }}
    </IsmsDocumentShell>
  );
}
