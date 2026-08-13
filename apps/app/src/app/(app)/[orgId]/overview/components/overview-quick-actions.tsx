'use client';

import {
  getPolicyAcknowledgmentTotal,
  PolicyAcknowledgmentInvalidationDialog,
} from '@/components/policies/PolicyAcknowledgmentInvalidationDialog';
import type { Policy } from '@db';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

export interface PendingOffboardingMember {
  memberId: string;
  name: string;
  email: string;
  offboardDate: string;
  completedItems: number;
  totalItems: number;
}

export interface PendingOffboardingResponse {
  members: PendingOffboardingMember[];
}

type PublishablePolicy = Pick<Policy, 'signedBy'>;

export function formatQuickActionStatus(status: string) {
  return status.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getQuickActionProgressWidth({
  totalPolicies,
  totalTasks,
  unpublishedPolicies,
  incompleteTasks,
}: {
  totalPolicies: number;
  totalTasks: number;
  unpublishedPolicies: number;
  incompleteTasks: number;
}) {
  if (totalPolicies + totalTasks === 0) {
    return 0;
  }

  return (
    ((totalPolicies + totalTasks - (unpublishedPolicies + incompleteTasks)) /
      (totalPolicies + totalTasks)) *
    100
  );
}

export function usePublishAllPoliciesAction({
  unpublishedPolicies,
}: {
  unpublishedPolicies: PublishablePolicy[];
}) {
  const router = useRouter();
  const t = useTranslations('overview');
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isPublishingRef = useRef(false);
  const bulkAcknowledgmentInvalidations = useMemo(
    () => getPolicyAcknowledgmentTotal(unpublishedPolicies),
    [unpublishedPolicies],
  );

  const handlePublishAllPolicies = async () => {
    if (isPublishingRef.current) {
      return;
    }

    isPublishingRef.current = true;
    setIsLoading(true);
    try {
      const response = await fetch('/api/policies/publish-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to publish policies');
      }

      toast.success(t('quickActions.publishAllSuccess'));
      setIsConfirmDialogOpen(false);
      router.refresh();
    } catch {
      toast.error(t('quickActions.publishAllError'));
    } finally {
      isPublishingRef.current = false;
      setIsLoading(false);
    }
  };

  const handlePublishAllClick = () => {
    if (isPublishingRef.current) {
      return;
    }

    if (bulkAcknowledgmentInvalidations === 0) {
      void handlePublishAllPolicies();
      return;
    }

    setIsConfirmDialogOpen(true);
  };

  const publishAllPoliciesDialog = (
    <PolicyAcknowledgmentInvalidationDialog
      acknowledgmentCount={bulkAcknowledgmentInvalidations}
      actionDescription={t('quickActions.publishingDescription')}
      confirmText={t('quickActions.publishAndInvalidate')}
      isLoading={isLoading}
      onConfirm={() => void handlePublishAllPolicies()}
      onOpenChange={setIsConfirmDialogOpen}
      open={isConfirmDialogOpen}
    />
  );

  return {
    handlePublishAllClick,
    isPublishing: isLoading,
    publishAllPoliciesDialog,
  };
}
