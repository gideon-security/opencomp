'use client';

import { formatDateShort } from '@/lib/format';

import { useTranslations } from 'next-intl';
import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  HStack,
  Spinner,
  TableCell,
  TableRow,
  Text,
} from '@trycompai/design-system';
import {
  Edit,
  OverflowMenuVertical,
  TrashCan,
  View,
  ViewOff,
} from '@trycompai/design-system/icons';
import { Copy } from 'lucide-react';
import type { Secret } from '../../hooks/useSecrets';

type SettingsTranslator = ReturnType<typeof useTranslations<'settings'>>;

function categoryLabel(t: SettingsTranslator, category: string): string {
  switch (category) {
    case 'api_keys':
      return t('secrets.categories.api_keys');
    case 'database':
      return t('secrets.categories.database');
    case 'authentication':
      return t('secrets.categories.authentication');
    case 'integration':
      return t('secrets.categories.integration');
    case 'other':
      return t('secrets.categories.other');
    default:
      return category.replace('_', ' ');
  }
}

function formatDate(date: string): string {
  return formatDateShort(date);
}

export function SecretRow({
  secret,
  revealedValue,
  isLoading,
  canEdit,
  canDelete,
  onReveal,
  onCopy,
  onEdit,
  onDelete,
}: {
  secret: Secret;
  revealedValue: string | undefined;
  isLoading: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onReveal: (secretId: string) => void;
  onCopy: (secretId: string) => void;
  onEdit: (secret: Secret) => void;
  onDelete: (secret: Secret) => void;
}) {
  const t = useTranslations('settings');

  return (
    <TableRow key={secret.id}>
      <TableCell>
        <span className="font-mono text-sm font-medium">{secret.name}</span>
      </TableCell>
      <TableCell>
        <HStack gap="2" align="center">
          {isLoading ? (
            <HStack gap="2" align="center">
              <Spinner />
              <Text variant="muted" size="sm">
                {t('secrets.table.loading')}
              </Text>
            </HStack>
          ) : revealedValue ? (
            <button
              type="button"
              onClick={() => onCopy(secret.id)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1 font-mono text-sm transition-colors hover:bg-muted/80"
            >
              <span className="max-w-[200px] truncate">{revealedValue}</span>
              <Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
            </button>
          ) : (
            <span className="font-mono text-sm text-muted-foreground">
              ••••••••••••
            </span>
          )}
          <button
            type="button"
            onClick={() => onReveal(secret.id)}
            disabled={isLoading}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            {revealedValue ? <ViewOff size={16} /> : <View size={16} />}
          </button>
        </HStack>
      </TableCell>
      <TableCell>
        {secret.category ? (
          <Badge variant="secondary">
            {categoryLabel(t, secret.category)}
          </Badge>
        ) : (
          <Text variant="muted" size="sm">
            —
          </Text>
        )}
      </TableCell>
      <TableCell>
        <Text variant="muted" size="sm">
          {secret.lastUsedAt ? formatDate(secret.lastUsedAt) : t('secrets.table.never')}
        </Text>
      </TableCell>
      <TableCell>
        <Text variant="muted" size="sm">
          {formatDate(secret.createdAt)}
        </Text>
      </TableCell>
      {(canEdit || canDelete) && (
        <TableCell>
          <div className="flex justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger variant="ellipsis" onClick={(e) => e.stopPropagation()}>
                <OverflowMenuVertical />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(secret);
                    }}
                  >
                    <Edit size={16} />
                    {t('secrets.table.edit')}
                  </DropdownMenuItem>
                )}
                {canEdit && canDelete && <DropdownMenuSeparator />}
                {canDelete && (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(secret);
                    }}
                  >
                    <TrashCan size={16} />
                    {t('secrets.table.delete')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}
