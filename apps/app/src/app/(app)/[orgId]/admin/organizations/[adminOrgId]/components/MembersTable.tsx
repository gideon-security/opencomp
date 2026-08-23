'use client';

import { useTranslations } from 'next-intl';
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@trycompai/design-system';
import { Login } from '@trycompai/design-system/icons';
import type { OrgMember } from './MembersTabTypes';

export function MembersTable({
  members,
  impersonatingUserId,
  onImpersonate,
}: {
  members: OrgMember[];
  impersonatingUserId: string | null;
  onImpersonate: (member: OrgMember) => void;
}) {
  const t = useTranslations('admin');

  return (
    <Table variant="bordered">
      <TableHeader>
        <TableRow>
          <TableHead>{t('organizations.membersTab.name')}</TableHead>
          <TableHead>{t('organizations.membersTab.email')}</TableHead>
          <TableHead>{t('organizations.membersTab.role')}</TableHead>
          <TableHead>{t('organizations.membersTab.joined')}</TableHead>
          <TableHead>{t('organizations.membersTab.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...members].sort((a, b) => a.user.name.localeCompare(b.user.name)).map((member) => (
          <TableRow key={member.id}>
            <TableCell>
              <div className="max-w-[200px] truncate">
                <Text size="sm" weight="medium">
                  {member.user.name}
                </Text>
              </div>
            </TableCell>
            <TableCell>
              <div className="max-w-[250px] truncate">
                <Text size="sm" variant="muted">
                  {member.user.email}
                </Text>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">
                {member.role.replace(/\b\w/g, (c) => c.toUpperCase())}
              </Badge>
            </TableCell>
            <TableCell>
              <Text size="sm" variant="muted">
                {new Date(member.createdAt).toLocaleDateString()}
              </Text>
            </TableCell>
            <TableCell>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onImpersonate(member)}
                loading={impersonatingUserId === member.user.id}
                disabled={impersonatingUserId !== null}
                iconLeft={<Login size={16} />}
              >
                {t('organizations.membersTab.loginAs')}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
