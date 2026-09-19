import { beforeEach, describe, expect, it, vi } from 'vitest';

// Only external boundaries are mocked, so the resume filter and trigger
// options are both exercised.
const mocks = vi.hoisted(() => ({
  trigger: vi.fn(),
  metadataSet: vi.fn(),
  policyFindMany: vi.fn(),
  policyVersionFindMany: vi.fn(),
}));

vi.mock('@gideon-defender/trigger-local', () => ({
  task: vi.fn((config) => config),
  queue: vi.fn((config) => config),
  tags: { add: vi.fn() },
  metadata: { set: mocks.metadataSet, increment: vi.fn(), decrement: vi.fn() },
  tasks: {
    trigger: mocks.trigger,
    batchTrigger: vi.fn(),
    batchTriggerAndWait: vi.fn(),
    triggerAndWait: vi.fn(),
  },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@db/server', () => ({
  db: {
    policy: { findMany: mocks.policyFindMany },
    policyVersion: { findMany: mocks.policyVersionFindMany },
    vendor: { findMany: vi.fn() },
    risk: { findMany: vi.fn() },
    member: { findFirst: vi.fn() },
    organization: { findUnique: vi.fn() },
    frameworkEditorPolicyTemplate: { findUnique: vi.fn() },
    policyVersionDelete: vi.fn(),
  },
}));

vi.mock('@db', async (importOriginal) => ({
  ...(await importOriginal()),
}));

vi.mock('axios', () => ({ default: { post: vi.fn() } }));

import { triggerPolicyUpdates } from './trigger-policy-updates';

const ORG = 'org_1';
const POLICIES = [
  { id: 'pol_1', name: 'P1' },
  { id: 'pol_2', name: 'P2' },
  { id: 'pol_3', name: 'P3' },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.policyFindMany.mockResolvedValue(POLICIES);
  mocks.trigger.mockResolvedValue({ id: 'run_1' });
});

describe('triggerPolicyUpdates resume', () => {
  it('batches only policies without a tailored version', async () => {
    mocks.policyVersionFindMany.mockResolvedValue([
      { policyId: 'pol_1', changelog: 'Regenerated policy content' },
      { policyId: 'pol_3', changelog: 'Regenerated policy content' },
    ]);

    await triggerPolicyUpdates({ organizationId: ORG, questionsAndAnswers: [], frameworks: [] });

    expect(mocks.policyVersionFindMany).toHaveBeenCalledWith({
      where: { policyId: { in: ['pol_1', 'pol_2', 'pol_3'] } },
      select: { policyId: true, changelog: true },
    });
    expect(mocks.trigger).toHaveBeenCalledWith(
      'update-policy',
      expect.objectContaining({ organizationId: ORG, policyId: 'pol_2' }),
      {
        concurrencyKey: ORG,
        idempotencyKey: 'onboarding-policy-update:org_1:pol_2',
        idempotencyKeyTTL: '24h',
      },
    );
    // Tailored policies count as completed so the UI shows resumed progress.
    expect(mocks.metadataSet).toHaveBeenCalledWith('policiesCompleted', 2);
    expect(mocks.metadataSet).toHaveBeenCalledWith('policiesRemaining', 1);
    expect(mocks.metadataSet).toHaveBeenCalledWith('policy_pol_1_status', 'completed');
    expect(mocks.metadataSet).toHaveBeenCalledWith('policy_pol_2_status', 'queued');
  });

  it('treats seed versions as untailored — org setup seeds every policy with v1', async () => {
    // initialize-organization.ts writes one v1 row per policy with the seed
    // changelog before tailoring ever runs. Row existence alone must not
    // count as tailored or first-run tailoring silently never happens.
    mocks.policyVersionFindMany.mockResolvedValue([
      { policyId: 'pol_1', changelog: 'Initial version from template' },
      { policyId: 'pol_2', changelog: 'Initial version from template' },
      { policyId: 'pol_3', changelog: 'Initial version from template' },
    ]);

    await triggerPolicyUpdates({ organizationId: ORG, questionsAndAnswers: [], frameworks: [] });

    expect(mocks.trigger).toHaveBeenCalledTimes(3);
    expect(mocks.trigger).toHaveBeenNthCalledWith(
      1,
      'update-policy',
      expect.objectContaining({ policyId: 'pol_1' }),
      expect.objectContaining({ idempotencyKey: 'onboarding-policy-update:org_1:pol_1' }),
    );
    expect(mocks.trigger).toHaveBeenNthCalledWith(
      2,
      'update-policy',
      expect.objectContaining({ policyId: 'pol_2' }),
      expect.objectContaining({ idempotencyKey: 'onboarding-policy-update:org_1:pol_2' }),
    );
    expect(mocks.trigger).toHaveBeenNthCalledWith(
      3,
      'update-policy',
      expect.objectContaining({ policyId: 'pol_3' }),
      expect.objectContaining({ idempotencyKey: 'onboarding-policy-update:org_1:pol_3' }),
    );
    expect(mocks.metadataSet).toHaveBeenCalledWith('policiesCompleted', 0);
    expect(mocks.metadataSet).toHaveBeenCalledWith('policiesRemaining', 3);
  });

  it('fires no LLM work when every policy is already tailored', async () => {
    mocks.policyVersionFindMany.mockResolvedValue([
      { policyId: 'pol_1', changelog: 'Regenerated policy content' },
      { policyId: 'pol_2', changelog: 'Regenerated policy content' },
      { policyId: 'pol_3', changelog: 'Regenerated policy content' },
    ]);

    await triggerPolicyUpdates({ organizationId: ORG, questionsAndAnswers: [], frameworks: [] });

    expect(mocks.trigger).not.toHaveBeenCalled();
    expect(mocks.metadataSet).toHaveBeenCalledWith('policiesCompleted', 3);
    expect(mocks.metadataSet).toHaveBeenCalledWith('policiesRemaining', 0);
  });

  it('treats null and hand-written changelogs as untailored — only exact tailored matches count', async () => {
    // A null changelog (legacy row, manual version without a message) or a
    // hand-written one (user edit) is not AI tailoring. Skipping it would
    // ship template content as done, so it stays pending.
    mocks.policyVersionFindMany.mockResolvedValue([
      { policyId: 'pol_1', changelog: null },
      { policyId: 'pol_2', changelog: 'Fixed a typo' },
      { policyId: 'pol_3', changelog: 'Regenerated policy content' },
    ]);

    await triggerPolicyUpdates({ organizationId: ORG, questionsAndAnswers: [], frameworks: [] });

    expect(mocks.trigger).toHaveBeenCalledTimes(2);
    expect(mocks.trigger).toHaveBeenCalledWith(
      'update-policy',
      expect.objectContaining({ policyId: 'pol_1' }),
      expect.any(Object),
    );
    expect(mocks.trigger).toHaveBeenCalledWith(
      'update-policy',
      expect.objectContaining({ policyId: 'pol_2' }),
      expect.any(Object),
    );
    expect(mocks.metadataSet).toHaveBeenCalledWith('policiesCompleted', 1);
    expect(mocks.metadataSet).toHaveBeenCalledWith('policiesRemaining', 2);
    expect(mocks.metadataSet).toHaveBeenCalledWith('policy_pol_3_status', 'completed');
  });

  it('handles seed plus tailored rows for the same policy — the retried shape', async () => {
    // A retried tailoring run leaves [seed, tailored] rows behind. The
    // tailored row marks the policy done even though a seed row exists.
    mocks.policyVersionFindMany.mockResolvedValue([
      { policyId: 'pol_1', changelog: 'Initial version from template' },
      { policyId: 'pol_1', changelog: 'Regenerated policy content' },
      { policyId: 'pol_2', changelog: 'Initial version from template' },
      { policyId: 'pol_2', changelog: null },
    ]);

    await triggerPolicyUpdates({ organizationId: ORG, questionsAndAnswers: [], frameworks: [] });

    expect(mocks.trigger).toHaveBeenCalledTimes(2);
    expect(mocks.trigger).toHaveBeenCalledWith(
      'update-policy',
      expect.objectContaining({ policyId: 'pol_2' }),
      expect.any(Object),
    );
    expect(mocks.trigger).toHaveBeenCalledWith(
      'update-policy',
      expect.objectContaining({ policyId: 'pol_3' }),
      expect.any(Object),
    );
    expect(mocks.metadataSet).toHaveBeenCalledWith('policiesCompleted', 1);
    expect(mocks.metadataSet).toHaveBeenCalledWith('policiesRemaining', 2);
  });

  it('preserves existing behavior when nothing is tailored yet', async () => {
    mocks.policyVersionFindMany.mockResolvedValue([]);

    await triggerPolicyUpdates({ organizationId: ORG, questionsAndAnswers: [], frameworks: [] });

    expect(mocks.trigger).toHaveBeenCalledTimes(3);
  });
});
