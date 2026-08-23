'use client';

import { Stack } from '@trycompai/design-system';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { IsmsDocument as IsmsDocumentData } from '../isms-types';
import { AuditsList } from './AuditsList';
import type { AuditHandlers } from './AuditCard';
import type { ApproverOption } from './IsmsApprovalSection';
import { IsmsDocumentShell } from './IsmsDocumentShell';
import { ProgrammeCard } from './ProgrammeCard';
import {
  toAuditPayload,
  toControlPayload,
  toFindingPayload,
  toSignoffPayload,
} from './audit-schema';
import { auditValidationMessages } from './internal-audit-labels';

interface InternalAuditClientProps {
  organizationId: string;
  documentId: string;
  fallbackData: IsmsDocumentData | null;
  currentMemberId: string | null;
  approverOptions: ApproverOption[];
  memberOptions: ApproverOption[];
  /** Internal Auditor holder(s) from ISMS > Roles (5.3) — the auditor dropdown. */
  auditorOptions?: string[];
}

const AUDITS = 'audits' as const;
const CONTROLS = 'audit-controls' as const;
const FINDINGS = 'audit-findings' as const;

async function run(action: Promise<void>, successMessage: string, failMessage: string) {
  try {
    await action;
    toast.success(successMessage);
  } catch (caught) {
    toast.error(caught instanceof Error ? caught.message : failMessage);
    // Re-throw so the calling form/row keeps its state on failure.
    throw caught;
  }
}

export function InternalAuditClient({
  memberOptions,
  auditorOptions = [],
  ...props
}: InternalAuditClientProps) {
  const t = useTranslations('isms.internalAudit');
  const tIsms = useTranslations('isms');
  return (
    <IsmsDocumentShell
      {...props}
      clause="9.2"
      title={t('title')}
      description={t('description')}
      sectionTitle={t('sectionTitle')}
      sectionDescription={t('sectionDescription')}
      generateSuccessMessage={t('generateRestored')}
      getSubmitBlockedReason={(document) => {
        const messages = auditValidationMessages(tIsms, {
          audits: Array.isArray(document.audits) ? document.audits : [],
        });
        return messages.length > 0
          ? t('submitBlocked', { messages: messages.join(' ') })
          : null;
      }}
    >
      {({ document, canManage, hook }) => {
        const audits = Array.isArray(document.audits) ? document.audits : [];
        const validationMessages = auditValidationMessages(tIsms, { audits });

        const handlers: AuditHandlers = {
          onUpdateAudit: (auditId, values) =>
            run(
              hook.updateRow({ register: AUDITS, id: auditId, data: toAuditPayload(values) }),
              t('auditUpdated'),
              t('auditUpdateFailed'),
            ),
          onDeleteAudit: (auditId) =>
            run(
              hook.deleteRow({ register: AUDITS, id: auditId }),
              t('auditDeleted'),
              t('auditDeleteFailed'),
            ),
          onSaveSignoff: (auditId, values) =>
            run(
              hook.updateRow({ register: AUDITS, id: auditId, data: toSignoffPayload(values) }),
              t('signoffSaved'),
              t('signoffSaveFailed'),
            ),
          onCreateControl: (auditId, values) =>
            run(
              hook.createRow({
                register: CONTROLS,
                data: { auditId, ...toControlPayload(values) },
              }),
              t('controlRowAdded'),
              t('controlRowAddFailed'),
            ),
          onUpdateControl: (controlId, payload) =>
            run(
              hook.updateRow({ register: CONTROLS, id: controlId, data: payload }),
              t('controlRowUpdated'),
              t('controlRowUpdateFailed'),
            ),
          onDeleteControl: (controlId) =>
            run(
              hook.deleteRow({ register: CONTROLS, id: controlId }),
              t('controlRowDeleted'),
              t('controlRowDeleteFailed'),
            ),
          onCreateFinding: (auditId, values) =>
            run(
              hook.createRow({
                register: FINDINGS,
                data: { auditId, ...toFindingPayload(values) },
              }),
              t('findingAdded'),
              t('findingAddFailed'),
            ),
          onUpdateFinding: (findingId, values) =>
            run(
              hook.updateRow({
                register: FINDINGS,
                id: findingId,
                data: toFindingPayload(values),
              }),
              t('findingUpdated'),
              t('findingUpdateFailed'),
            ),
          onDeleteFinding: (findingId) =>
            run(
              hook.deleteRow({ register: FINDINGS, id: findingId }),
              t('findingDeleted'),
              t('findingDeleteFailed'),
            ),
        };

        return (
          <Stack gap="6">
            <ProgrammeCard
              narrative={document.draftNarrative}
              canEdit={canManage}
              onSave={(programme) =>
                run(
                  hook.saveNarrative({ programme }),
                  t('programmeSaved'),
                  t('programmeSaveFailed'),
                )
              }
            />
            <AuditsList
              audits={audits}
              canEdit={canManage}
              memberOptions={memberOptions}
              auditorOptions={auditorOptions}
              validationMessages={validationMessages}
              onCreateAudit={() =>
                run(
                  hook.createRow({ register: AUDITS, data: {} }),
                  t('auditCreated'),
                  t('auditCreateFailed'),
                )
              }
              {...handlers}
            />
          </Stack>
        );
      }}
    </IsmsDocumentShell>
  );
}
