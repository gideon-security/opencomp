import { Logger } from '@nestjs/common';
import {
  backgroundCheckStatuses,
  mapCheckrReportToStatus,
} from './background-checks.types';
import { isRecord } from './checkr.utils';

const logger = new Logger('CheckrCreateStatus');

/**
 * Status mapping for the creation flow. An unrecognized vendor status must
 * never fail creation after the candidate, invitation, and charge already
 * exist: keep the check invited and let webhooks/reconcile advance it.
 */
export function toCreateStatus(report: unknown): string {
  const mapped = mapCheckrReportToStatus(report);
  if (
    mapped !== '' &&
    (backgroundCheckStatuses as readonly string[]).includes(mapped)
  ) {
    return mapped;
  }
  const logged = isRecord(report)
    ? {
        status: report.status ?? null,
        adjudication: report.adjudication ?? null,
      }
    : { status: null, adjudication: null };
  logger.warn(
    'Checkr returned an unrecognized status during creation; keeping check invited',
    logged,
  );
  return 'invited';
}
