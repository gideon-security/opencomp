'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { IsmsDocument as IsmsDocumentData } from '../isms-types';
import type { ApproverOption } from './IsmsApprovalSection';
import { IsmsDocumentShell } from './IsmsDocumentShell';
import { RolesTable } from './RolesTable';
import type { RoleFormValues } from './role-schema';
import { roleValidationMessages, teamSizeBand } from './roles-constants';

interface RolesClientProps {
  organizationId: string;
  documentId: string;
  fallbackData: IsmsDocumentData | null;
  currentMemberId: string | null;
  approverOptions: ApproverOption[];
  memberOptions: ApproverOption[];
}

const ROLES = 'roles' as const;
const ASSIGNMENTS = 'role-assignments' as const;

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

export function RolesClient({ memberOptions, ...props }: RolesClientProps) {
  const t = useTranslations('isms');
  const band = teamSizeBand(memberOptions.length);
  // memberOptions is the active People list, so this is the set of active member
  // ids — used to match the server's active-only completeness gate.
  const activeMemberIds = new Set(memberOptions.map((member) => member.id));

  return (
    <IsmsDocumentShell
      {...props}
      clause="5.3"
      title={t('roles.title')}
      description={t('roles.description')}
      sectionTitle={t('roles.sectionTitle')}
      sectionDescription={t('roles.sectionDescription')}
      generateSuccessMessage={t('roles.generateRestored')}
      getSubmitBlockedReason={(document) => {
        const messages = roleValidationMessages({
          roles: Array.isArray(document.roles) ? document.roles : [],
          band,
          activeMemberIds,
        });
        return messages.length > 0
          ? t('roles.submitBlocked', { messages: messages.join(' ') })
          : null;
      }}
    >
      {({ document, canManage, hook }) => {
        const roles = Array.isArray(document.roles) ? document.roles : [];
        const validationMessages = roleValidationMessages({
          roles,
          band,
          activeMemberIds,
        });

        return (
          <RolesTable
            roles={roles}
            canEdit={canManage}
            memberOptions={memberOptions}
            band={band}
            validationMessages={validationMessages}
            onCreateRole={(values: RoleFormValues) =>
              run(
                hook.createRow({ register: ROLES, data: { ...values } }),
                t('roles.roleAdded'),
                t('roles.roleAddFailed'),
              )
            }
            onUpdateRole={(roleId, values) =>
              run(
                hook.updateRow({ register: ROLES, id: roleId, data: { ...values } }),
                t('roles.roleUpdated'),
                t('roles.roleUpdateFailed'),
              )
            }
            onDeleteRole={(roleId) =>
              run(
                hook.deleteRow({ register: ROLES, id: roleId }),
                t('roles.roleDeleted'),
                t('roles.roleDeleteFailed'),
              )
            }
            onSaveAuditRoute={(roleId, update) =>
              run(
                hook.updateRow({ register: ROLES, id: roleId, data: { ...update } }),
                t('roles.auditRouteSaved'),
                t('roles.auditRouteSaveFailed'),
              )
            }
            onAddAssignment={(roleId, memberId) =>
              run(
                hook.createRow({
                  register: ASSIGNMENTS,
                  data: { roleId, memberId },
                }),
                t('roles.memberAssigned'),
                t('roles.memberAssignFailed'),
              )
            }
            onUpdateAssignment={(assignmentId, update) =>
              run(
                hook.updateRow({
                  register: ASSIGNMENTS,
                  id: assignmentId,
                  data: { ...update },
                }),
                t('roles.competenceUpdated'),
                t('roles.competenceUpdateFailed'),
              )
            }
            onRemoveAssignment={(assignmentId) =>
              run(
                hook.deleteRow({ register: ASSIGNMENTS, id: assignmentId }),
                t('roles.memberRemoved'),
                t('roles.memberRemoveFailed'),
              )
            }
          />
        );
      }}
    </IsmsDocumentShell>
  );
}
