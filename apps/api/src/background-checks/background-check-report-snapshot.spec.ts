import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { BackgroundCheckStatus } from '@db';
import { fetchCompletedReportSnapshot } from './background-check-report-snapshot';
import type { CheckrClient } from './checkr.client';

function stubClient(impl: Record<string, unknown>) {
  return impl as unknown as CheckrClient;
}

describe('fetchCompletedReportSnapshot', () => {
  it('returns null without touching the vendor for non-terminal states', async () => {
    const getReport = jest.fn();
    const snapshot = await fetchCompletedReportSnapshot({
      identityClient: stubClient({ getReport }),
      identityBackgroundCheckId: 'rep_1',
      eventType: 'report.updated',
      status: BackgroundCheckStatus.in_progress,
    });

    expect(snapshot).toBeNull();
    expect(getReport).not.toHaveBeenCalled();
  });

  it('returns the report snapshot for terminal states', async () => {
    const snapshot = await fetchCompletedReportSnapshot({
      identityClient: stubClient({
        getReport: jest
          .fn()
          .mockResolvedValue({ id: 'rep_1', status: 'clear' }),
      }),
      identityBackgroundCheckId: 'rep_1',
      eventType: 'report.completed',
      status: BackgroundCheckStatus.completed,
    });

    expect(snapshot).toEqual({ id: 'rep_1', status: 'clear' });
  });

  it('rethrows auth failures instead of dissolving them into backoff', async () => {
    // A bad key never heals by waiting: the caller must see the 401, not
    // a "not available yet" that retries forever.
    await expect(
      fetchCompletedReportSnapshot({
        identityClient: stubClient({
          getReport: jest
            .fn()
            .mockRejectedValue(
              new UnauthorizedException('Checkr credentials are invalid.'),
            ),
        }),
        identityBackgroundCheckId: 'rep_1',
        eventType: 'report.completed',
        status: BackgroundCheckStatus.completed,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('backs off with 503 when the report cannot be read yet', async () => {
    await expect(
      fetchCompletedReportSnapshot({
        identityClient: stubClient({
          getReport: jest.fn().mockResolvedValue(null),
        }),
        identityBackgroundCheckId: 'rep_1',
        eventType: 'report.completed',
        status: BackgroundCheckStatus.completed,
      }),
    ).rejects.toMatchObject({ status: 503 });
  });

  it('backs off with 503 on vendor blips instead of committing snapshot-less', async () => {
    await expect(
      fetchCompletedReportSnapshot({
        identityClient: stubClient({
          getReport: jest.fn().mockRejectedValue(new Error('vendor down')),
        }),
        identityBackgroundCheckId: 'rep_1',
        eventType: 'report.completed',
        status: BackgroundCheckStatus.completed,
      }),
    ).rejects.toMatchObject({ status: 503 });
  });

  it('rethrows missing configuration instead of masking it as 503', async () => {
    // A missing key never heals by waiting either: callers must see the
    // 400, not a "not available yet" that retries forever.
    await expect(
      fetchCompletedReportSnapshot({
        identityClient: stubClient({
          getReport: jest
            .fn()
            .mockRejectedValue(
              new BadRequestException(
                'Background check service is not configured.',
              ),
            ),
        }),
        identityBackgroundCheckId: 'rep_1',
        eventType: 'report.completed',
        status: BackgroundCheckStatus.completed,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
