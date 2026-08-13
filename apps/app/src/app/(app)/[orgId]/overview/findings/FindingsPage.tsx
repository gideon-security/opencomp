'use client';

import { FindingsTab } from '../components/FindingsTab';
import { OverviewTabs } from '../components/OverviewTabs';
import { usePermissions } from '@/hooks/use-permissions';
import {
  Button,
  PageHeader,
  PageLayout,
} from '@trycompai/design-system';
import { Add } from '@trycompai/design-system/icons';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

/**
 * Client wrapper for the Findings route. Hosts the "Add finding" action in the
 * page header so it stays out of the table/filter row, and forwards the open
 * state into the FindingsTab sheet.
 */
export function FindingsPage({ orgId }: { orgId: string }) {
  const t = useTranslations('overview');
  const [createOpen, setCreateOpen] = useState(false);
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('finding', 'create');

  return (
    <PageLayout
      header={
        <PageHeader
          title={t('findings.pageTitle')}
          tabs={<OverviewTabs />}
          actions={
            canCreate ? (
              <Button
                size="sm"
                iconLeft={<Add size={16} />}
                onClick={() => setCreateOpen(true)}
              >
                {t('findings.addFinding')}
              </Button>
            ) : null
          }
        />
      }
    >
      <FindingsTab
        organizationId={orgId}
        createOpen={createOpen}
        onCreateOpenChange={setCreateOpen}
      />
    </PageLayout>
  );
}
