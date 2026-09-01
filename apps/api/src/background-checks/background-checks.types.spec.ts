import { mapCheckrReportToStatus } from './background-checks.types';

describe('mapCheckrReportToStatus', () => {
  it.each([
    [{ status: 'clear' }, 'completed'],
    [{ status: 'CLEAR' }, 'completed'],
    [{ status: 'consider', adjudication: 'engaged' }, 'completed_with_flags'],
    [{ status: 'suspended' }, 'in_review'],
    [{ status: 'disputed' }, 'in_review'],
    [{ status: 'consider' }, 'in_review'],
    [{ status: 'review' }, 'in_review'],
    [{ status: 'pending' }, 'in_progress'],
    [{ status: 'in_progress' }, 'in_progress'],
    [{ status: 'canceled' }, 'cancelled'],
    [{ status: 'cancelled' }, 'cancelled'],
    [{ status: 'failed' }, 'failed'],
    [{ status: 'expired' }, 'failed'],
    [{ status: 'deleted' }, 'cancelled'],
    [{ status: 'completed' }, 'completed'],
    [{ status: 'completed_with_flags' }, 'completed_with_flags'],
    [{}, ''],
  ])('maps %j to %s', (report, expected) => {
    expect(mapCheckrReportToStatus(report)).toBe(expected);
  });

  it('returns empty string for status-less payloads so callers leave status alone', () => {
    expect(mapCheckrReportToStatus({ id: 'inv_1' })).toBe('');
  });

  it('returns empty string for unknown statuses so callers reject them', () => {
    expect(mapCheckrReportToStatus({ status: 'frobnicated' })).toBe('');
  });

  it('returns empty string for nullish input instead of throwing', () => {
    expect(mapCheckrReportToStatus(null)).toBe('');
    expect(mapCheckrReportToStatus(undefined)).toBe('');
  });
});
