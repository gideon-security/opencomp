import {
  deriveWebhookEventIdentity,
  fingerprintReport,
  isStaleIndirectEvent,
  WEBHOOK_FUTURE_SKEW_MS,
  WEBHOOK_MAX_AGE_MS,
  webhookEventAgeMs,
  webhookEventTimeMs,
} from './background-check-webhook-resolve';

describe('webhookEventAgeMs', () => {
  it('reads camelCase epoch seconds', () => {
    const age = webhookEventAgeMs({
      updatedAt: Math.floor(Date.now() / 1000) - 60,
    });
    expect(age).toBeGreaterThan(0);
    expect(age).toBeLessThan(120_000);
  });

  it('reads snake_case ISO-8601 strings from real Checkr payloads', () => {
    const age = webhookEventAgeMs({
      updated_at: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(age).toBeGreaterThan(0);
    expect(age).toBeLessThan(120_000);
  });

  it('reads numeric strings and epoch milliseconds', () => {
    const seconds = webhookEventAgeMs({
      completedAt: String(Math.floor(Date.now() / 1000) - 30),
    });
    expect(seconds).toBeGreaterThan(0);
    const millis = webhookEventAgeMs({ createdAt: Date.now() - 30_000 });
    expect(millis).toBeGreaterThan(0);
  });

  it('returns null when the payload carries no usable timestamp', () => {
    expect(webhookEventAgeMs({})).toBeNull();
    expect(webhookEventAgeMs({ updatedAt: 'not-a-date' })).toBeNull();
    expect(webhookEventAgeMs({ updatedAt: null })).toBeNull();
  });

  it('goes negative for future-dated payloads so the caller can reject them', () => {
    const age = webhookEventAgeMs({
      updatedAt: Math.floor(Date.now() / 1000) + 3_600,
    });
    expect(age).not.toBeNull();
    expect(age as number).toBeLessThan(-WEBHOOK_FUTURE_SKEW_MS);
  });

  it('measures a 25-hour-old delivery past the max age', () => {
    const age = webhookEventAgeMs({
      updated_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    });
    expect(age).not.toBeNull();
    expect(age as number).toBeGreaterThan(WEBHOOK_MAX_AGE_MS);
  });
});

describe('webhookEventTimeMs', () => {
  it('reads the newest timestamp from the inner report object', () => {
    const now = Date.now();
    expect(
      webhookEventTimeMs({
        created_at: new Date(now - 120_000).toISOString(),
        updated_at: new Date(now - 60_000).toISOString(),
      }),
    ).toBeLessThanOrEqual(now);
    expect(
      webhookEventTimeMs({
        created_at: new Date(now - 120_000).toISOString(),
        updated_at: new Date(now - 60_000).toISOString(),
      }) as number,
    ).toBeGreaterThan(now - 90_000);
  });

  it('unwraps the full envelope the same way live deliveries read', () => {
    const stamp = new Date(Date.now() - 30_000).toISOString();
    expect(
      webhookEventTimeMs({ id: 'evt_1', data: { updated_at: stamp } }),
    ).toEqual(webhookEventTimeMs({ updated_at: stamp }));
  });

  it('returns null when neither the envelope nor the report has time', () => {
    expect(webhookEventTimeMs({ id: 'evt_1', data: {} })).toBeNull();
    expect(webhookEventTimeMs(null)).toBeNull();
    expect(webhookEventTimeMs('evt_1')).toBeNull();
  });
});

describe('isStaleIndirectEvent', () => {
  it('never flags direct hits or invitation events', () => {
    const record = {
      identityBackgroundCheckId: 'rep_2',
      checkrInvitationId: 'inv_2',
      supersededIdentityBackgroundCheckIds: ['rep_1'],
    };
    expect(
      isStaleIndirectEvent({
        via: 'direct',
        isReportEvent: true,
        record,
        reportId: 'rep_1',
      }),
    ).toBe(false);
    expect(
      isStaleIndirectEvent({
        via: 'candidate',
        isReportEvent: false,
        record,
        reportId: 'rep_1',
      }),
    ).toBe(false);
  });

  it('accepts the first report for a fresh invited row', () => {
    expect(
      isStaleIndirectEvent({
        via: 'member',
        isReportEvent: true,
        record: {
          identityBackgroundCheckId: 'inv_1',
          checkrInvitationId: 'inv_1',
          supersededIdentityBackgroundCheckIds: [],
        },
        reportId: 'rep_1',
      }),
    ).toBe(false);
  });

  it('flags a late event for a superseded report after a retry', () => {
    expect(
      isStaleIndirectEvent({
        via: 'candidate',
        isReportEvent: true,
        record: {
          identityBackgroundCheckId: 'rep_2',
          checkrInvitationId: 'inv_2',
          supersededIdentityBackgroundCheckIds: ['rep_1'],
        },
        reportId: 'rep_1',
      }),
    ).toBe(true);
  });

  it('flags a superseded report against an ungraduated retried pointer', () => {
    // The retry swapped in a fresh invitation pointer, but this event
    // names the prior attempt — it must not rewind the row.
    expect(
      isStaleIndirectEvent({
        via: 'member',
        isReportEvent: true,
        record: {
          identityBackgroundCheckId: 'inv_new',
          checkrInvitationId: 'inv_new',
          supersededIdentityBackgroundCheckIds: ['rep_old'],
        },
        reportId: 'rep_old',
      }),
    ).toBe(true);
  });

  it('accepts the new report for a retried row with an ungraduated pointer', () => {
    // The retry swapped in a fresh invitation pointer that can never
    // match the new report directly. The event names no superseded
    // report, so it is the report arriving — not a stale one.
    expect(
      isStaleIndirectEvent({
        via: 'member',
        isReportEvent: true,
        record: {
          identityBackgroundCheckId: 'inv_new',
          checkrInvitationId: 'inv_new',
          supersededIdentityBackgroundCheckIds: ['rep_old'],
        },
        reportId: 'rep_new',
      }),
    ).toBe(false);
  });
});

describe('deriveWebhookEventIdentity', () => {
  it('prefers the vendor event id header', () => {
    expect(
      deriveWebhookEventIdentity({
        headers: { 'x-checkr-event-id': 'evt_9' },
        reportId: 'rep_1',
        reportFingerprint: 'abc',
      }),
    ).toEqual({ eventId: 'evt_9', eventType: 'report.updated' });
  });

  it('falls back to report, type, and fingerprint so distinct states never collapse', () => {
    const first = deriveWebhookEventIdentity({
      headers: {},
      reportId: 'rep_1',
      reportFingerprint: fingerprintReport({ status: 'pending' }),
    });
    const second = deriveWebhookEventIdentity({
      headers: {},
      reportId: 'rep_1',
      reportFingerprint: fingerprintReport({ status: 'clear' }),
    });
    expect(first.eventId).not.toEqual(second.eventId);
  });
});
