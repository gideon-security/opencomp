'use client';

import { useTranslations } from 'next-intl';
import { Badge, Button, TableCell, TableRow, Text } from '@trycompai/design-system';
import { TrashCan } from '@trycompai/design-system/icons';
import { getActiveFrameworkDetails, type ActiveFramework } from './FrameworksTabTypes';

export function ActiveFrameworkRow({
  framework,
  onDelete,
}: {
  framework: ActiveFramework;
  onDelete: (framework: ActiveFramework) => void;
}) {
  const t = useTranslations('admin');
  const details = getActiveFrameworkDetails(framework);

  return (
    <TableRow>
      <TableCell>
        <div className="max-w-[420px]">
          <div className="truncate">
            <Text size="sm" weight="medium">
              {details?.name ?? t('organizations.frameworksTab.unknownFramework')}
            </Text>
          </div>
          {details?.description && (
            <div className="truncate">
              <Text size="xs" variant="muted">
                {details.description}
              </Text>
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline">v{details?.version ?? '--'}</Badge>
      </TableCell>
      <TableCell>
        <Badge variant={framework.customFramework ? 'secondary' : 'default'}>
          {framework.customFramework
            ? t('organizations.frameworksTab.custom')
            : t('organizations.frameworksTab.platform')}
        </Badge>
      </TableCell>
      <TableCell>
        <Button
          size="sm"
          variant="destructive"
          iconLeft={<TrashCan size={16} />}
          onClick={() => onDelete(framework)}
        >
          {t('organizations.frameworksTab.remove')}
        </Button>
      </TableCell>
    </TableRow>
  );
}
