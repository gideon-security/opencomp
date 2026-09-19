import { beforeEach, describe, expect, it, vi } from 'vitest';

// triggerPolicyUpdates is tested against the REAL helpers module (only its
// external boundaries are mocked) so the resume filter is verified, not a stub.
const mocks = vi.hoisted(() => ({
  batchTrigger: vi.fn(),
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
    trigger: vi.fn(),
    batchTrigger: mocks.batchTrigger,
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

import { triggerPolicyUpdates } from './onboard-organization-helpers';

const ORG = 'org_1';
const POLICIES = [
  { id: 'pol_1', name: 'P1' },
  { id: 'pol_2', name: 'P2' },
  { id: 'pol_3', name: 'P3' },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.policyFindMany.mockResolvedValue(POLICIES);
});

describe('triggerPolicyUpdates resume', () => {
  it('batches only policies without a published version', async () => {
    mocks.policyVersionFindMany.mockResolvedValue([{ policyId: 'pol_1' }, { policyId: 'pol_3' }]);

    await triggerPolicyUpdates(ORG, [], []);

    expect(mocks.policyVersionFindMany).toHaveBeenCalledWith({
      where: { policyId: { in: ['pol_1', 'pol_2', 'pol_3'] } },
      select: { policyId: true },
    });
    expect(mocks.batchTrigger).toHaveBeenCalledTimes(1);
    const items = mocks.batchTrigger.mock.calls[0][1] as Array<{ payload: { policyId: string } }>;
    expect(items.map((i) => i.payload.policyId)).toEqual(['pol_2']);
    // Tailored policies count as completed so the UI shows resumed progress.
    expect(mocks.metadataSet).toHaveBeenCalledWith('policiesCompleted', 2);
    expect(mocks.metadataSet).toHaveBeenCalledWith('policiesRemaining', 1);
    expect(mocks.metadataSet).toHaveBeenCalledWith('policy_pol_1_status', 'completed');
    expect(mocks.metadataSet).toHaveBeenCalledWith('policy_pol_2_status', 'queued');
  });

  it('fires no LLM work when every policy is already tailored', async () => {
    mocks.policyVersionFindMany.mockResolvedValue([
      { policyId: 'pol_1' },
      { policyId: 'pol_2' },
      { policyId: 'pol_3' },
    ]);

    await triggerPolicyUpdates(ORG, [], []);

    expect(mocks.batchTrigger).not.toHaveBeenCalled();
    expect(mocks.metadataSet).toHaveBeenCalledWith('policiesCompleted', 3);
    expect(mocks.metadataSet).toHaveBeenCalledWith('policiesRemaining', 0);
  });

  it('preserves existing behavior when nothing is tailored yet', async () => {
    mocks.policyVersionFindMany.mockResolvedValue([]);

    await triggerPolicyUpdates(ORG, [], []);

    expect(mocks.batchTrigger).toHaveBeenCalledTimes(1);
    const items = mocks.batchTrigger.mock.calls[0][1] as Array<{ payload: { policyId: string } }>;
    expect(items.map((i) => i.payload.policyId)).toEqual(['pol_1', 'pol_2', 'pol_3']);
  });
});
