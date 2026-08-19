'use client';

import { RiskMatrixChart } from '@/components/risks/charts/RiskMatrixChart';
import { NotAssessedState } from '@/components/risks/treatment-plan/NotAssessedState';
import { usePermissions } from '@/hooks/use-permissions';
import { useVendor, useVendorActions } from '@/hooks/use-vendors';
import { suggestedResidual } from '@/lib/suggested-residual';
import { VendorStatus, type TaskStatus, type Vendor } from '@db';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

interface ResidualRiskChartProps {
  vendor: Vendor & { tasks?: { status: TaskStatus }[] };
}

export function VendorResidualRiskChart({ vendor }: ResidualRiskChartProps) {
  const { updateVendor, triggerAssessment } = useVendorActions();
  const { mutate } = useVendor(vendor.id);
  const { hasPermission } = usePermissions();
  const t = useTranslations('vendor');

  const canUpdate = hasPermission('vendor', 'update');

  if (vendor.status === VendorStatus.not_assessed) {
    return (
      <NotAssessedState
        disabled={!canUpdate}
        description={t('detail.residualRiskEmptyDescription')}
        onAssess={async () => {
          try {
            await triggerAssessment(vendor.id);
            toast.success(t('detail.riskAssessmentStarted'));
            await mutate();
          } catch {
            toast.error(t('detail.riskAssessmentStartFailed'));
          }
        }}
      />
    );
  }

  // Only compute a suggestion when tasks are actually loaded — falling back to
  // [] would render a misleading "0% complete" ghost cell on vendors that
  // haven't hydrated yet.
  const suggestion = vendor.tasks
    ? suggestedResidual({
        likelihood: vendor.inherentProbability,
        impact: vendor.inherentImpact,
        strategy: vendor.treatmentStrategy,
        tasks: vendor.tasks,
      })
    : undefined;

  const preliminary = vendor.status === VendorStatus.in_progress;

  return (
    <RiskMatrixChart
      title={t('detail.residualRiskChartTitle')}
      description={t('detail.residualRiskChartDescription')}
      titleInfo={t('detail.residualRiskTitleInfo')}
      riskId={vendor.id}
      activeLikelihood={vendor.residualProbability}
      activeImpact={vendor.residualImpact}
      suggestedLikelihood={suggestion?.likelihood}
      suggestedImpact={suggestion?.impact}
      readOnly={!canUpdate}
      preliminary={preliminary}
      saveAction={async ({ id, probability, impact }) => {
        await updateVendor(id, {
          residualProbability: probability,
          residualImpact: impact,
        });
        mutate();
      }}
    />
  );
}
