'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { IsmsDocument as IsmsDocumentData } from '../isms-types';
import type { ApproverOption } from './IsmsApprovalSection';
import { IsmsDocumentShell } from './IsmsDocumentShell';
import { MonitoringTable } from './MonitoringTable';
import { toMetricPayload } from './metric-schema';
import { metricValidationMessages } from './monitoring-constants';

interface MonitoringClientProps {
  organizationId: string;
  documentId: string;
  fallbackData: IsmsDocumentData | null;
  currentMemberId: string | null;
  approverOptions: ApproverOption[];
  memberOptions: ApproverOption[];
}

const METRICS = 'metrics' as const;
const MEASUREMENTS = 'measurements' as const;

async function run(action: Promise<void>, successMessage: string, failMessage: string) {
  try {
    await action;
    toast.success(successMessage);
  } catch (caught) {
    toast.error(caught instanceof Error ? caught.message : failMessage);
    // Re-throw so the calling form/row keeps its state on failure.
    throw caught;
  }
}

export function MonitoringClient({ memberOptions, ...props }: MonitoringClientProps) {
  const t = useTranslations('isms');
  return (
    <IsmsDocumentShell
      {...props}
      clause="9.1"
      title={t('monitoring.title')}
      description={t('monitoring.description')}
      sectionTitle={t('monitoring.sectionTitle')}
      sectionDescription={t('monitoring.sectionDescription')}
      generateSuccessMessage={t('monitoring.generateRestored')}
      getSubmitBlockedReason={(document) => {
        const messages = metricValidationMessages({
          metrics: Array.isArray(document.metrics) ? document.metrics : [],
        });
        return messages.length > 0
          ? t('monitoring.submitBlocked', { messages: messages.join(' ') })
          : null;
      }}
    >
      {({ document, canManage, hook }) => {
        const metrics = Array.isArray(document.metrics) ? document.metrics : [];
        const validationMessages = metricValidationMessages({ metrics });

        return (
          <MonitoringTable
            metrics={metrics}
            canEdit={canManage}
            memberOptions={memberOptions}
            validationMessages={validationMessages}
            onCreateMetric={(values) =>
              run(
                hook.createRow({ register: METRICS, data: toMetricPayload(values) }),
                t('monitoring.metricAdded'),
                t('monitoring.metricAddFailed'),
              )
            }
            onUpdateMetric={(metricId, payload) =>
              run(
                hook.updateRow({ register: METRICS, id: metricId, data: payload }),
                t('monitoring.metricUpdated'),
                t('monitoring.metricUpdateFailed'),
              )
            }
            onDeleteMetric={(metricId) =>
              run(
                hook.deleteRow({ register: METRICS, id: metricId }),
                t('monitoring.metricDeleted'),
                t('monitoring.metricDeleteFailed'),
              )
            }
            onRecordMeasurement={(metricId, values) =>
              run(
                hook.createRow({
                  register: MEASUREMENTS,
                  data: {
                    metricId,
                    periodStart: values.periodStart,
                    value: values.value,
                    note: values.note || null,
                  },
                }),
                t('monitoring.measurementRecorded'),
                t('monitoring.measurementRecordFailed'),
              )
            }
            onBulkSaveMeasurements={(rows) =>
              run(
                hook.bulkCreateMeasurements(rows),
                t('monitoring.measurementsRecorded', { count: rows.length }),
                t('monitoring.measurementsRecordFailed'),
              )
            }
            onDeleteMeasurement={(measurementId) =>
              run(
                hook.deleteRow({ register: MEASUREMENTS, id: measurementId }),
                t('monitoring.measurementDeleted'),
                t('monitoring.measurementDeleteFailed'),
              )
            }
          />
        );
      }}
    </IsmsDocumentShell>
  );
}
