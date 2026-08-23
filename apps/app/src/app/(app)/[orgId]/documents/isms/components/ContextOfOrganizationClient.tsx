'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { IsmsContextIssueKind, IsmsDocument as IsmsDocumentData } from '../isms-types';
import { IsmsDocumentShell } from './IsmsDocumentShell';
import { IssuesRegister } from './IssuesRegister';
import type { ApproverOption } from './IsmsApprovalSection';

interface ContextOfOrganizationClientProps {
  organizationId: string;
  documentId: string;
  fallbackData: IsmsDocumentData | null;
  currentMemberId: string | null;
  approverOptions: ApproverOption[];
}

export function ContextOfOrganizationClient(props: ContextOfOrganizationClientProps) {
  const t = useTranslations('isms');

  return (
    <IsmsDocumentShell
      {...props}
      clause="4.1"
      title={t('contextOrg.title')}
      description={t('contextOrg.description')}
      sectionTitle={t('contextOrg.sectionTitle')}
      sectionDescription={t('contextOrg.sectionDescription')}
      generateSuccessMessage={t('contextOrg.generatedSuccess')}
    >
      {({ document, canManage, hook }) => {
        const handleCreateIssue = async (params: {
          kind: IsmsContextIssueKind;
          description: string;
          effect: string;
        }) => {
          try {
            await hook.createIssue(params);
            toast.success(t('contextOrg.issueAdded'));
          } catch (caught) {
            toast.error(
              caught instanceof Error ? caught.message : t('contextOrg.issueAddFailed'),
            );
            // Re-throw so the form keeps the user's input and stays open on failure.
            throw caught;
          }
        };

        const handleUpdateIssue = async (params: {
          issueId: string;
          input: { description: string; effect: string };
        }) => {
          try {
            await hook.updateIssue(params);
            toast.success(t('contextOrg.issueUpdated'));
          } catch (caught) {
            toast.error(
              caught instanceof Error ? caught.message : t('contextOrg.issueUpdateFailed'),
            );
            // Re-throw so the row stays in edit mode with the user's changes on failure.
            throw caught;
          }
        };

        const handleDeleteIssue = async (issueId: string) => {
          try {
            await hook.deleteIssue(issueId);
            toast.success(t('contextOrg.issueDeleted'));
          } catch (caught) {
            toast.error(
              caught instanceof Error ? caught.message : t('contextOrg.issueDeleteFailed'),
            );
            // Re-throw so the row's delete state resets only after a real outcome.
            throw caught;
          }
        };

        const issues = Array.isArray(document.contextIssues) ? document.contextIssues : [];

        return (
          <IssuesRegister
            issues={issues}
            canEdit={canManage}
            onCreate={handleCreateIssue}
            onUpdate={handleUpdateIssue}
            onDelete={handleDeleteIssue}
          />
        );
      }}
    </IsmsDocumentShell>
  );
}
