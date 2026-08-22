'use client';

import { apiClient } from '@/lib/api-client';
import { Badge, Button, Grid, HStack, Stack, Text } from '@trycompai/design-system';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import useSWR from 'swr';
import { BackgroundCheckReport } from './BackgroundCheckReport';
import {
  type BackgroundCheckRecord,
  type BackgroundCheckStatus,
  type CustomBackgroundCheckAttachment,
  isCompletedBackgroundCheck,
} from './backgroundCheckTypes';

type Translator = ReturnType<typeof useTranslations<'people'>>;

const COMPONENT_KEYS = ['identityStatus', 'employmentStatus', 'referenceStatus'] as const;

const statusLabel = (status: BackgroundCheckStatus, t: Translator): string => {
  switch (status) {
    case 'invited':
      return t('backgroundCheck.status.invited');
    case 'in_progress':
      return t('backgroundCheck.status.inProgress');
    case 'in_review':
      return t('backgroundCheck.status.inReview');
    case 'completed':
      return t('backgroundCheck.status.complete');
    case 'completed_with_flags':
      return t('backgroundCheck.status.completeWithFlags');
    case 'failed':
      return t('backgroundCheck.status.failed');
    case 'cancelled':
      return t('backgroundCheck.status.cancelled');
  }
};

const componentLabel = (key: (typeof COMPONENT_KEYS)[number], t: Translator): string => {
  switch (key) {
    case 'employmentStatus':
      return t('backgroundCheck.components.employment');
    case 'referenceStatus':
      return t('backgroundCheck.components.references');
    default:
      return t('backgroundCheck.components.identity');
  }
};

export function BackgroundCheckStatusView({
  backgroundCheck,
  confirmation,
  memberId,
  organizationId,
  actions,
}: {
  backgroundCheck: BackgroundCheckRecord;
  confirmation?: string | null;
  memberId?: string;
  organizationId?: string;
  actions?: ReactNode;
}) {
  const t = useTranslations('people');
  const isComplete = isCompletedBackgroundCheck(backgroundCheck.status);
  const customAttachmentsKey =
    isComplete && memberId && organizationId
      ? ([`/v1/people/${memberId}/background-check/custom-attachments`, organizationId] as const)
      : null;
  const { data: customAttachments, isLoading: isCustomAttachmentsLoading } = useSWR<
    CustomBackgroundCheckAttachment[],
    Error,
    readonly [string, string] | null
  >(customAttachmentsKey, async ([endpoint, orgId]) => {
    const response = await apiClient.get<CustomBackgroundCheckAttachment[]>(endpoint, orgId);
    if (response.error) {
      throw new Error(t('backgroundCheck.view.attachmentsLoadError'));
    }
    return response.data ?? [];
  });

  const handleCopyCandidateLink = async () => {
    if (!backgroundCheck.candidateUrl) return;

    try {
      await navigator.clipboard.writeText(backgroundCheck.candidateUrl);
      toast.success(t('backgroundCheck.view.candidateLinkCopied'));
    } catch {
      toast.error(t('backgroundCheck.view.couldNotCopyLink'));
    }
  };

  return (
    <Stack gap="xl">
      {confirmation && (
        <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
          <Stack gap="xs">
            <Text weight="medium">{t('backgroundCheck.view.requestedTitle')}</Text>
            <Text size="sm" variant="muted">
              {confirmation}
            </Text>
          </Stack>
        </div>
      )}

      <div className="rounded-md border bg-muted/20 p-4">
        <Stack gap="md">
          <HStack justify="between" align="start">
            <Stack gap="xs">
              <Text weight="medium">{t('backgroundCheck.view.statusHeading')}</Text>
              <HStack gap="2" align="center">
                <Badge variant="secondary">{statusLabel(backgroundCheck.status, t)}</Badge>
                {backgroundCheck.lastSyncedAt && (
                  <Text size="xs" variant="muted">
                    {t('backgroundCheck.view.updated', {
                      date: new Date(backgroundCheck.lastSyncedAt).toLocaleString(),
                    })}
                  </Text>
                )}
              </HStack>
            </Stack>
            {backgroundCheck.candidateUrl && !isComplete && (
              <Button type="button" variant="outline" onClick={handleCopyCandidateLink}>
                {t('backgroundCheck.view.copyCandidateLink')}
              </Button>
            )}
          </HStack>

          <Grid cols={{ base: '1', md: '2' }} gap="4">
            <ReadOnlyField
              label={t('backgroundCheck.view.employeeName')}
              value={backgroundCheck.employeeName}
            />
            <ReadOnlyField
              label={t('backgroundCheck.view.personalEmail')}
              value={backgroundCheck.employeeEmail}
            />
          </Grid>

          <ComponentStatuses backgroundCheck={backgroundCheck} />
          {actions}
        </Stack>
      </div>

      {backgroundCheck.requesterNotes && (
        <ReadOnlyField
          label={t('backgroundCheck.view.additionalInfo')}
          value={backgroundCheck.requesterNotes}
        />
      )}

      {isComplete &&
        (backgroundCheck.reportSnapshot ? (
          <BackgroundCheckReport
            snapshot={backgroundCheck.reportSnapshot}
            syncedAt={backgroundCheck.reportSyncedAt}
          />
        ) : isCustomAttachmentsLoading ? (
          <ReportSyncingState />
        ) : customAttachments && customAttachments.length > 0 ? (
          <CustomReportAttachments
            attachments={customAttachments}
            organizationId={organizationId ?? ''}
          />
        ) : (
          <ReportSyncingState />
        ))}
    </Stack>
  );
}

function CustomReportAttachments({
  attachments,
  organizationId,
}: {
  attachments: CustomBackgroundCheckAttachment[];
  organizationId: string;
}) {
  const t = useTranslations('people');
  const handleDownload = async (attachmentId: string) => {
    const response = await apiClient.get<{ downloadUrl: string }>(
      `/v1/attachments/${attachmentId}/download`,
      organizationId,
    );

    if (response.error || !response.data?.downloadUrl) {
      toast.error(t('backgroundCheck.view.attachmentOpenError'));
      return;
    }

    window.open(response.data.downloadUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="rounded-md border bg-muted/20 p-4">
      <Stack gap="md">
        <Stack gap="xs">
          <Text weight="medium">{t('backgroundCheck.view.customCheckTitle')}</Text>
          <Text size="sm" variant="muted">
            {t('backgroundCheck.view.customCheckDescription')}
          </Text>
        </Stack>
        <Stack gap="sm">
          {attachments.map((attachment) => (
            <HStack key={attachment.id} justify="between" align="center">
              <Stack gap="xs">
                <Text size="sm">{attachment.name}</Text>
                <Text size="xs" variant="muted">
                  {t('backgroundCheck.view.uploadedAt', {
                    date: new Date(attachment.createdAt).toLocaleString(),
                  })}
                </Text>
              </Stack>
              <Button type="button" variant="outline" onClick={() => handleDownload(attachment.id)}>
                {t('backgroundCheck.view.openAttachment')}
              </Button>
            </HStack>
          ))}
        </Stack>
      </Stack>
    </div>
  );
}

function ComponentStatuses({ backgroundCheck }: { backgroundCheck: BackgroundCheckRecord }) {
  const t = useTranslations('people');
  const statuses = COMPONENT_KEYS.flatMap((key) => {
    const value = backgroundCheck[key];
    return value ? [{ label: componentLabel(key, t), value }] : [];
  });

  if (statuses.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map(({ label, value }) => (
        <Badge key={label} variant="secondary">
          {label}: {formatLabel(value)}
        </Badge>
      ))}
    </div>
  );
}

function ReportSyncingState() {
  const t = useTranslations('people');
  return (
    <div className="rounded-md border border-dashed bg-muted/20 p-4">
      <Stack gap="xs">
        <Text weight="medium">{t('backgroundCheck.view.reportSyncingTitle')}</Text>
        <Text size="sm" variant="muted">
          {t('backgroundCheck.view.reportSyncingDescription')}
        </Text>
      </Stack>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap="xs">
      <Text size="sm" variant="muted">
        {label}
      </Text>
      <Text>{value}</Text>
    </Stack>
  );
}

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
