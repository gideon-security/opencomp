'use client';

import { Badge, Button, HStack, Stack, Text } from '@trycompai/design-system';
import { useTranslations } from 'next-intl';
import type { FrameworkUpdateStatus } from '@/types/framework-versioning';

interface UpdateAvailableBannerProps {
  status: FrameworkUpdateStatus;
  canUpdate: boolean;
  onReview: () => void;
  hasActiveAudit?: boolean;
}

export function UpdateAvailableBanner({
  status,
  canUpdate,
  onReview,
  hasActiveAudit,
}: UpdateAvailableBannerProps) {
  const t = useTranslations('frameworks');
  if (!status.updateAvailable || !status.latestVersion) return null;

  return (
    <div className="rounded-md border p-4 bg-blue-50/50 dark:bg-blue-950/20">
      <Stack gap="3">
        <HStack gap="2" align="center">
          <Badge variant="secondary">{t('instance.updateAvailable')}</Badge>
          <Text weight="medium">
            v{status.currentVersion?.version ?? '—'} → v
            {status.latestVersion.version}
          </Text>
        </HStack>
        {status.latestVersion.releaseNotes && (
          <Text size="sm" variant="muted">
            {status.latestVersion.releaseNotes}
          </Text>
        )}
        {hasActiveAudit && (
          <Text size="sm" variant="muted">
            {t('instance.activeAuditWarning')}
          </Text>
        )}
        {canUpdate && (
          <div>
            <Button variant="default" onClick={onReview}>
              {t('instance.reviewUpdate')}
            </Button>
          </div>
        )}
      </Stack>
    </div>
  );
}
