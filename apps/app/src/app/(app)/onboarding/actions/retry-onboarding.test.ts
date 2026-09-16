import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockMemberFindFirst = vi.fn();
const mockOnboardingUpsert = vi.fn();
const mockOnboardingUpdate = vi.fn();
const mockTrigger = vi.fn();
const mockGetSession = vi.fn();
const mockSetActive = vi.fn();
const mockCookieSet = vi.fn();

vi.mock('@db/server', () => ({
  db: {
    member: { findFirst: (...args: unknown[]) => mockMemberFindFirst(...args) },
    onboarding: {
      upsert: (...args: unknown[]) => mockOnboardingUpsert(...args),
      update: (...args: unknown[]) => mockOnboardingUpdate(...args),
    },
  },
}));

vi.mock('@/utils/auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      setActiveOrganization: (...args: unknown[]) => mockSetActive(...args),
    },
  },
}));

vi.mock('@gideon-defender/trigger-local', () => ({
  tasks: { trigger: (...args: unknown[]) => mockTrigger(...args) },
  task: (def: unknown) => def,
  queue: {},
  tags: {},
  metadata: {},
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  auth: { createPublicToken: vi.fn() },
}));

vi.mock('@/app/posthog', () => ({
  track: vi.fn(),
}));

vi.mock('@gideon-defender/kv', () => ({
  client: {},
  createRateLimiter: () => ({
    limit: async () => ({ success: true, remaining: 10 }),
  }),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(
    async () =>
      new Headers([
        ['x-forwarded-for', '127.0.0.1'],
        ['user-agent', 'test-agent'],
      ]),
  ),
  cookies: vi.fn(async () => ({ set: (...args: unknown[]) => mockCookieSet(...args) })),
}));

import { retryOnboarding } from './retry-onboarding';

const session = {
  session: { id: 'ses_1', activeOrganizationId: 'org_1' },
  user: { id: 'usr_admin', email: 'admin@platform.com' },
};

describe('retryOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(session);
    mockMemberFindFirst.mockResolvedValue({ id: 'mem_1' });
    mockSetActive.mockResolvedValue(session);
  });

  it('retriggers the onboard job and points the onboarding row at the new run', async () => {
    mockOnboardingUpsert.mockResolvedValue({ triggerJobCompleted: false });
    mockTrigger.mockResolvedValue({ id: 'run_new', publicAccessToken: 'tok_new' });
    mockOnboardingUpdate.mockResolvedValue({});

    const result = await retryOnboarding({ organizationId: 'org_1' });

    expect(mockTrigger).toHaveBeenCalledWith('onboard-organization', {
      organizationId: 'org_1',
    });
    expect(mockOnboardingUpdate).toHaveBeenCalledWith({
      where: { organizationId: 'org_1' },
      data: { triggerJobId: 'run_new', triggerJobCompleted: false },
    });
    expect(mockCookieSet).toHaveBeenCalledWith('publicAccessToken', 'tok_new');
    expect(result.data).toMatchObject({
      success: true,
      triggerJobId: 'run_new',
      redirectUrl: '/org_1/',
    });
  });

  it('does not retrigger when the run already completed', async () => {
    mockOnboardingUpsert.mockResolvedValue({ triggerJobCompleted: true });

    const result = await retryOnboarding({ organizationId: 'org_1' });

    expect(mockTrigger).not.toHaveBeenCalled();
    expect(result.data).toMatchObject({ success: true, redirectUrl: '/org_1/' });
  });

  it('denies users without membership in the org', async () => {
    mockMemberFindFirst.mockResolvedValue(null);

    const result = await retryOnboarding({ organizationId: 'org_1' });

    expect(mockTrigger).not.toHaveBeenCalled();
    expect(result.data).toMatchObject({ success: false, error: 'Access denied' });
  });
});
