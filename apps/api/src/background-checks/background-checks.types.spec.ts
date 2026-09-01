import {
  mapCheckrReportToStatus,
  shouldWriteWebhookStatus,
} from './background-checks.types';

describe('mapCheckrReportToStatus', () => {
  it.each([
    [{ status: 'clear' }, 'completed'],
    [{ status: 'CLEAR' }, 'completed'],
    [{ status: 'consider', adjudication: 'engaged' }, 'completed_with_flags'],
    [{ status: 'suspended' }, 'in_review'],
    [{ status: 'disputed' }, 'in_review'],
    [{ status: 'dispute' }, 'in_review'],
    [{ status: 'DISPUTE' }, 'in_review'],
    [{ status: 'complete', result: 'clear' }, 'completed'],
    [{ status: 'complete', result: 'consider' }, 'completed_with_flags'],
    [{ status: 'complete' }, 'completed'],
    [{ status: 'complete', adjudication: 'engaged' }, 'completed_with_flags'],
    [{ status: 'COMPLETE', result: 'CLEAR' }, 'completed'],
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

  it.each([{ status: 42 }, { status: { nested: true } }, { status: ['x'] }])(
    'returns empty string for non-string statuses instead of throwing (%j)',
    (report) => {
      expect(mapCheckrReportToStatus(report)).toBe('');
    },
  );

  it('ignores a non-string adjudication instead of throwing', () => {
    expect(
      mapCheckrReportToStatus({ status: 'consider', adjudication: 42 }),
    ).toBe('in_review');
  });

  it('ignores a non-string result instead of throwing', () => {
    expect(mapCheckrReportToStatus({ status: 'complete', result: 42 })).toBe(
      'completed',
    );
  });
});

describe('shouldWriteWebhookStatus', () => {
  it('writes every report event with a status', () => {
    expect(
      shouldWriteWebhookStatus({
        isReportEvent: true,
        status: 'completed',
        recordStatus: 'in_progress',
      }),
    ).toBe(true);
  });

  it('writes in-flight invitation advances', () => {
    expect(
      shouldWriteWebhookStatus({
        isReportEvent: false,
        status: 'in_progress',
        recordStatus: 'invited',
      }),
    ).toBe(true);
  });

  it('never writes status-less events', () => {
    expect(
      shouldWriteWebhookStatus({
        isReportEvent: true,
        status: null,
        recordStatus: 'invited',
      }),
    ).toBe(false);
  });

  it('blocks invitation terminal states on in-flight rows', () => {
    expect(
      shouldWriteWebhookStatus({
        isReportEvent: false,
        status: 'completed',
        recordStatus: 'in_progress',
        rawStatus: 'completed',
      }),
    ).toBe(false);
  });

  it('writes an expired invitation as failed on a still-invited row', () => {
    expect(
      shouldWriteWebhookStatus({
        isReportEvent: false,
        status: 'failed',
        recordStatus: 'invited',
        rawStatus: 'expired',
      }),
    ).toBe(true);
  });

  it('writes a deleted invitation as cancelled on a still-invited row', () => {
    expect(
      shouldWriteWebhookStatus({
        isReportEvent: false,
        status: 'cancelled',
        recordStatus: 'invited',
        rawStatus: 'deleted',
      }),
    ).toBe(true);
  });

  it('blocks expired invitations once the row left invited', () => {
    expect(
      shouldWriteWebhookStatus({
        isReportEvent: false,
        status: 'failed',
        recordStatus: 'in_progress',
        rawStatus: 'expired',
      }),
    ).toBe(false);
  });
});
