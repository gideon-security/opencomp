'use client';

import { usePermissions } from '@/hooks/use-permissions';
import { useVendor, useVendorActions } from '@/hooks/use-vendors';
import { RiskMatrixChart } from '@/components/risks/charts/RiskMatrixChart';
import type { Vendor } from '@db';
import { useTranslations } from 'next-intl';

interface InherentRiskChartProps {
  vendor: Vendor;
}

export function VendorInherentRiskChart({ vendor }: InherentRiskChartProps) {
  const { updateVendor } = useVendorActions();
  const { mutate } = useVendor(vendor.id);
  const { hasPermission } = usePermissions();
  const t = useTranslations('vendor');

  return (
    <RiskMatrixChart
      title={t('detail.inherentRiskChartTitle')}
      description={t('detail.selectInherentRisk')}
      titleInfo={t('detail.inherentRiskTitleInfo')}
      riskId={vendor.id}
      activeLikelihood={vendor.inherentProbability}
      activeImpact={vendor.inherentImpact}
      readOnly={!hasPermission('vendor', 'update')}
      saveAction={async ({ id, probability, impact }) => {
        await updateVendor(id, {
          inherentProbability: probability,
          inherentImpact: impact,
        });
        mutate();
      }}
    />
  );
}
