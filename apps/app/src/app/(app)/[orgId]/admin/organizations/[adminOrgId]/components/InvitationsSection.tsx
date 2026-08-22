'use client';

import { useTranslations } from 'next-intl';
import {
  Badge,
  Button,
  Section,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@trycompai/design-system';
import { TrashCan } from '@trycompai/design-system/icons';
import type { PendingInvitation } from './MembersTabTypes';

export function InvitationsSection({
  invitations,
  loading,
  revokingId,
  onRevoke,
}: {
  invitations: PendingInvitation[];
  loading: boolean;
  revokingId: string | null;
  onRevoke: (id: string) => void;
}) {
  const t = useTranslations('admin');

  return (
    <Section
      title={t('organizations.membersTab.invitationsTitle', {
        count: invitations.length,
      })}
    >
      {loading ? (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          {t('organizations.membersTab.loadingInvitations')}
        </div>
      ) : invitations.length === 0 ? (
        <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          {t('organizations.membersTab.noInvitations')}
        </div>
      ) : (
        <Table variant="bordered">
          <TableHeader>
            <TableRow>
              <TableHead>{t('organizations.membersTab.email')}</TableHead>
              <TableHead>{t('organizations.membersTab.role')}</TableHead>
              <TableHead>{t('organizations.membersTab.invited')}</TableHead>
              <TableHead>{t('organizations.membersTab.expires')}</TableHead>
              <TableHead>{t('organizations.membersTab.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...invitations].sort((a, b) => a.email.localeCompare(b.email)).map((inv) => (
              <TableRow key={inv.id}>
                <TableCell>
                  <div className="max-w-[250px] truncate">
                    <Text size="sm">{inv.email}</Text>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {inv.role.replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Text size="sm" variant="muted">
                    {new Date(inv.createdAt).toLocaleDateString()}
                  </Text>
                </TableCell>
                <TableCell>
                  <Text size="sm" variant="muted">
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </Text>
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onRevoke(inv.id)}
                    loading={revokingId === inv.id}
                    iconLeft={<TrashCan size={16} />}
                  >
                    {t('organizations.membersTab.revoke')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Section>
  );
}
