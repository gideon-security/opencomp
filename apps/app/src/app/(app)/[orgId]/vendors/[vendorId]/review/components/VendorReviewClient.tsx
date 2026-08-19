'use client';

import { VendorRiskAssessmentView } from '@/components/vendor-risk-assessment/VendorRiskAssessmentView';
import { useTaskItems } from '@/hooks/use-task-items';
import { useVendor, type VendorResponse } from '@/hooks/use-vendors';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo } from 'react';

interface VendorReviewClientProps {
  vendorId: string;
  initialVendor: VendorResponse;
}

/**
 * Client component for vendor risk assessment review
 * Uses SWR with polling to auto-refresh when risk assessment completes
 */
export function VendorReviewClient({
  vendorId,
  initialVendor,
}: VendorReviewClientProps) {
  const t = useTranslations('vendor');
  // Use SWR for real-time updates with polling (5s default)
  const { vendor: swrVendor } = useVendor(vendorId, {
    initialData: initialVendor,
  });

  const {
    data: taskItemsResponse,
    mutate: refreshTaskItems,
  } = useTaskItems(
    vendorId,
    'vendor',
    1,
    50,
    'createdAt',
    'desc',
    {},
    {
      // Avoid always-on polling; we only poll aggressively while generating
      refreshInterval: 0,
      revalidateOnFocus: true,
    },
  );

  // Use SWR data when available, fall back to initial data
  const vendor = useMemo(() => {
    return swrVendor ?? initialVendor;
  }, [swrVendor, initialVendor]);

  const riskAssessmentData = vendor.riskAssessmentData;
  const riskAssessmentUpdatedAt = vendor.riskAssessmentUpdatedAt ?? null;

  // Mirror the Tasks section behavior:
  // If the "Verify risk assessment" task is in progress, the assessment is still generating.
  const hasGeneratingVerifyRiskAssessmentTask = useMemo(() => {
    const allTaskItems = taskItemsResponse?.data?.data ?? [];
    return allTaskItems.some(
      (t) => t.title === 'Verify risk assessment' && t.status === 'in_progress',
    );
  }, [taskItemsResponse]);

  useEffect(() => {
    if (!hasGeneratingVerifyRiskAssessmentTask) return;

    const interval = setInterval(() => {
      void refreshTaskItems();
    }, 3000);

    return () => clearInterval(interval);
  }, [hasGeneratingVerifyRiskAssessmentTask, refreshTaskItems]);

  // Show risk assessment data if available
  if (riskAssessmentData) {
    return (
      <VendorRiskAssessmentView
        source={{
          title: t('detail.riskAssessmentTitle'),
          description: JSON.stringify(riskAssessmentData),
          createdAt: riskAssessmentUpdatedAt ?? vendor.updatedAt,
          entityType: 'vendor',
          createdByName: null,
          createdByEmail: null,
        }}
      />
    );
  }

  // Show loading state if still processing
  if (vendor.status === 'in_progress' || hasGeneratingVerifyRiskAssessmentTask) {
    return (
      <div className="rounded-lg border border-border bg-card p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
          </div>
          <div className="flex flex-col items-center gap-1.5 text-center">
            <p className="text-sm font-medium text-foreground">
              {t('detail.analyzingRiskProfile')}
            </p>
            <p className="text-sm text-muted-foreground max-w-md">
              {t('detail.analyzingRiskProfileDescription')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show "not available" for assessed vendors without data
  return (
    <div className="rounded-lg border border-border bg-card p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">
          {t('detail.noRiskAssessmentAvailable')}
        </p>
      </div>
    </div>
  );
}
