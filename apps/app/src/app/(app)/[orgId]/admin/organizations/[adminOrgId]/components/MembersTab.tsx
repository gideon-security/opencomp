'use client';

import { api } from '@/lib/api-client';
import { authClient } from '@/utils/auth-client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Section,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Stack,
} from '@trycompai/design-system';
import { Add } from '@trycompai/design-system/icons';
import { Input } from '@gideon-defender/ui/input';
import { Label } from '@gideon-defender/ui/label';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { InvitationsSection } from './InvitationsSection';
import { MembersTable } from './MembersTable';
import type { OrgMember, PendingInvitation } from './MembersTabTypes';

const INVITE_ROLES = ['admin', 'auditor', 'employee', 'contractor'];

type AdminTranslator = ReturnType<typeof useTranslations<'admin'>>;

function roleLabel(t: AdminTranslator, role: string): string {
  switch (role) {
    case 'admin':
      return t('organizations.membersTab.roles.admin');
    case 'auditor':
      return t('organizations.membersTab.roles.auditor');
    case 'employee':
      return t('organizations.membersTab.roles.employee');
    case 'contractor':
      return t('organizations.membersTab.roles.contractor');
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
}

export function MembersTab({
  orgId,
  orgName,
  members,
}: {
  orgId: string;
  orgName: string;
  members: OrgMember[];
}) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('employee');
  const [inviting, setInviting] = useState(false);
  const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(
    null,
  );
  const [impersonateTarget, setImpersonateTarget] = useState<OrgMember | null>(
    null,
  );
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    setLoadingInvitations(true);
    const res = await api.get<PendingInvitation[]>(
      `/v1/admin/organizations/${orgId}/invitations`,
    );
    if (res.data) setInvitations(res.data);
    setLoadingInvitations(false);
  }, [orgId]);

  useEffect(() => {
    void fetchInvitations();
  }, [fetchInvitations]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    const res = await api.post(
      `/v1/admin/organizations/${orgId}/invite`,
      { email: inviteEmail.trim(), role: inviteRole },
    );
    if (!res.error) {
      setInviteEmail('');
      setInviteRole('employee');
      setShowInviteForm(false);
      void fetchInvitations();
    }
    setInviting(false);
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    setRevokingId(invitationId);
    const res = await api.delete(
      `/v1/admin/organizations/${orgId}/invitations/${invitationId}`,
    );
    if (!res.error) {
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
    }
    setRevokingId(null);
  };

  const handleRequestImpersonate = (member: OrgMember) => {
    setImpersonateTarget(member);
  };

  const handleConfirmImpersonate = async () => {
    if (!impersonateTarget) return;
    const userId = impersonateTarget.user.id;
    setImpersonateTarget(null);
    setImpersonatingUserId(userId);
    try {
      await authClient.admin.impersonateUser({ userId });
      await authClient.organization.setActive({ organizationId: orgId });
      router.push(`/${orgId}/overview`);
    } catch (err) {
      console.error('Impersonation failed:', err);
      setImpersonatingUserId(null);
    }
  };

  const handleSheetChange = (open: boolean) => {
    setShowInviteForm(open);
    if (!open) {
      setInviteEmail('');
      setInviteRole('employee');
    }
  };

  return (
    <>
      <Stack gap="lg">
        <Section
          title={t('organizations.membersTab.members', { count: members.length })}
          actions={
            <Button
              size="sm"
              iconLeft={<Add size={16} />}
              onClick={() => setShowInviteForm(true)}
            >
              {t('organizations.membersTab.inviteMember')}
            </Button>
          }
        >
          <MembersTable
            members={members}
            impersonatingUserId={impersonatingUserId}
            onImpersonate={handleRequestImpersonate}
          />
        </Section>

        <InvitationsSection
          invitations={invitations}
          loading={loadingInvitations}
          revokingId={revokingId}
          onRevoke={handleRevokeInvitation}
        />
      </Stack>

      <Sheet open={showInviteForm} onOpenChange={handleSheetChange}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {t('organizations.membersTab.inviteSheetTitle', { orgName })}
            </SheetTitle>
          </SheetHeader>
          <SheetBody>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleInvite();
              }}
            >
              <Stack gap="md">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="invite-email">
                    {t('organizations.membersTab.email')}
                  </Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="user@example.com"
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="invite-role">
                    {t('organizations.membersTab.role')}
                  </Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(v) => {
                      if (v) setInviteRole(v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INVITE_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {roleLabel(t, r)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="submit"
                  loading={inviting}
                  disabled={!inviteEmail.trim()}
                >
                  {t('organizations.membersTab.sendInvitation')}
                </Button>
              </Stack>
            </form>
          </SheetBody>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!impersonateTarget}
        onOpenChange={(open) => {
          if (!open) setImpersonateTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('organizations.membersTab.impersonate.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('organizations.membersTab.impersonate.descriptionPrefix')}{' '}
              <strong>{impersonateTarget?.user.name}</strong> (
              {impersonateTarget?.user.email}).{' '}
              {t('organizations.membersTab.impersonate.descriptionSuffix')}{' '}
              <em>impersonatedBy</em>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('organizations.membersTab.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmImpersonate}
            >
              {t('organizations.membersTab.impersonate.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
