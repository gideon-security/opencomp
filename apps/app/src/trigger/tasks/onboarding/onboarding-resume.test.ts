import { beforeEach, describe, expect, it, vi } from 'vitest';

// Shared handles (vi.mock factories are hoisted — define fns via vi.hoisted).
const mocks = vi.hoisted(() => ({
  batchTrigger: vi.fn(),
  batchTriggerAndWait: vi.fn(),
  triggerAndWait: vi.fn(),
  metadataSet: vi.fn(),
  policyFindMany: vi.fn(),
  policyVersionFindMany: vi.fn(),
  vendorFindMany: vi.fn(),
  riskFindMany: vi.fn(),
  frameworkInstanceFindMany: vi.fn(),
  memberFindFirst: vi.fn(),
  frameworkEditorFrameworkFindMany: vi.fn(),
  onboardingUpdate: vi.fn(),
  axiosPost: vi.fn(),
  getOrganizationContext: vi.fn(),
  extractVendorsFromContext: vi.fn(),
  createVendors: vi.fn(),
  createRisks: vi.fn(),
  updateOrganizationPolicies: vi.fn(),
  findCommentAuthor: vi.fn(),
}));

vi.mock('@gideon-defender/trigger-local', () => ({
  task: vi.fn((config) => config),
  queue: vi.fn((config) => config),
  tags: { add: vi.fn() },
  metadata: { set: mocks.metadataSet, increment: vi.fn(), decrement: vi.fn() },
  tasks: {
    trigger: vi.fn(),
    batchTrigger: mocks.batchTrigger,
    batchTriggerAndWait: mocks.batchTriggerAndWait,
    triggerAndWait: mocks.triggerAndWait,
  },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@db/server', () => ({
  db: {
    policy: { findMany: mocks.policyFindMany },
    policyVersion: { findMany: mocks.policyVersionFindMany },
    vendor: { findMany: mocks.vendorFindMany },
    risk: { findMany: mocks.riskFindMany },
    frameworkInstance: { findMany: mocks.frameworkInstanceFindMany },
    member: { findFirst: mocks.memberFindFirst, update: vi.fn() },
    task: { updateMany: vi.fn() },
    frameworkEditorFramework: { findMany: mocks.frameworkEditorFrameworkFindMany },
    onboarding: { update: mocks.onboardingUpdate },
  },
}));

vi.mock('axios', () => ({ default: { post: mocks.axiosPost } }));

vi.mock('./onboard-organization-helpers', () => ({
  getOrganizationContext: mocks.getOrganizationContext,
  extractVendorsFromContext: mocks.extractVendorsFromContext,
  createVendors: mocks.createVendors,
  createRisks: mocks.createRisks,
  updateOrganizationPolicies: mocks.updateOrganizationPolicies,
  findCommentAuthor: mocks.findCommentAuthor,
  createVendorRiskComment: vi.fn(),
  createRiskMitigationComment: vi.fn(),
}));

vi.mock('../auditor/generate-auditor-content', () => ({
  generateAuditorContentTask: {},
}));

import { onboardOrganization } from './onboard-organization';
import { generateRiskMitigationsForOrg } from './generate-risk-mitigation';
import { generateVendorMitigationsForOrg } from './generate-vendor-mitigation';

// The trigger-local mock returns the task config (including `run`), while
// the real Task type hides it — unwrap for direct invocation in tests.
type Runnable = { run: (payload: { organizationId: string }) => Promise<unknown> };
const vendorFanout = generateVendorMitigationsForOrg as unknown as Runnable;
const riskFanout = generateRiskMitigationsForOrg as unknown as Runnable;
const onboardRun = onboardOrganization as unknown as Runnable;

const ORG = 'org_1';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.axiosPost.mockResolvedValue({});
  mocks.triggerAndWait.mockResolvedValue(undefined);
  mocks.batchTrigger.mockResolvedValue(undefined);
  mocks.batchTriggerAndWait.mockResolvedValue({ runs: [] });
  mocks.getOrganizationContext.mockResolvedValue({
    organization: { name: 'Acme' },
    questionsAndAnswers: [],
    policies: [],
  });
  mocks.findCommentAuthor.mockResolvedValue({ id: 'mem_1' });
});

describe('vendor mitigation fan-out resume', () => {
  it('batches only vendors without a written mitigation plan', async () => {
    mocks.vendorFindMany.mockResolvedValue([
      { id: 'v_1', treatmentStrategyDescription: 'Done plan' },
      { id: 'v_2', treatmentStrategyDescription: null },
      { id: 'v_3', treatmentStrategyDescription: '  ' },
    ]);
    mocks.policyFindMany.mockResolvedValue([]);

    await vendorFanout.run({ organizationId: ORG });

    expect(mocks.batchTriggerAndWait).toHaveBeenCalledTimes(1);
    const items = mocks.batchTriggerAndWait.mock.calls[0][1] as Array<{
      payload: { vendorId: string };
    }>;
    expect(items.map((i) => i.payload.vendorId).sort()).toEqual(['v_2', 'v_3']);
  });

  it('fires no batch when every vendor is already mitigated', async () => {
    mocks.vendorFindMany.mockResolvedValue([
      { id: 'v_1', treatmentStrategyDescription: 'Done plan' },
    ]);
    mocks.policyFindMany.mockResolvedValue([]);

    await vendorFanout.run({ organizationId: ORG });

    expect(mocks.batchTriggerAndWait).not.toHaveBeenCalled();
  });
});

describe('risk mitigation fan-out resume', () => {
  it('batches only risks without a written mitigation plan', async () => {
    mocks.riskFindMany.mockResolvedValue([
      { id: 'r_1', treatmentStrategyDescription: 'Done plan' },
      { id: 'r_2', treatmentStrategyDescription: null },
    ]);
    mocks.policyFindMany.mockResolvedValue([]);

    await riskFanout.run({ organizationId: ORG });

    expect(mocks.batchTriggerAndWait).toHaveBeenCalledTimes(1);
    const items = mocks.batchTriggerAndWait.mock.calls[0][1] as Array<{
      payload: { riskId: string };
    }>;
    expect(items.map((i) => i.payload.riskId)).toEqual(['r_2']);
  });

  it('fires no batch when every risk is already mitigated', async () => {
    mocks.riskFindMany.mockResolvedValue([
      { id: 'r_1', treatmentStrategyDescription: 'Done plan' },
    ]);
    mocks.policyFindMany.mockResolvedValue([]);

    await riskFanout.run({ organizationId: ORG });

    expect(mocks.batchTriggerAndWait).not.toHaveBeenCalled();
  });
});

describe('onboard-organization extraction resume', () => {
  function mockOrgState() {
    mocks.frameworkInstanceFindMany.mockResolvedValue([]);
    mocks.memberFindFirst.mockResolvedValue({ id: 'mem_owner' });
    mocks.frameworkEditorFrameworkFindMany.mockResolvedValue([]);
    mocks.onboardingUpdate.mockResolvedValue({});
  }

  it('skips LLM extraction when vendors and risks already exist', async () => {
    mockOrgState();
    mocks.vendorFindMany.mockResolvedValue([{ id: 'v_1', name: 'Acme Corp' }]);
    mocks.riskFindMany.mockResolvedValue([{ id: 'r_1', description: 'Data breach' }]);

    await onboardRun.run({ organizationId: ORG });

    expect(mocks.extractVendorsFromContext).not.toHaveBeenCalled();
    expect(mocks.createVendors).not.toHaveBeenCalled();
    expect(mocks.createRisks).not.toHaveBeenCalled();
    expect(mocks.metadataSet).toHaveBeenCalledWith('vendors', true);
    expect(mocks.metadataSet).toHaveBeenCalledWith('risk', true);
  });

  it('still extracts on a fresh org with no rows', async () => {
    mockOrgState();
    mocks.vendorFindMany.mockResolvedValue([]);
    mocks.riskFindMany.mockResolvedValue([]);
    mocks.extractVendorsFromContext.mockResolvedValue([]);
    mocks.createVendors.mockResolvedValue([]);
    mocks.createRisks.mockResolvedValue([]);

    await onboardRun.run({ organizationId: ORG });

    expect(mocks.extractVendorsFromContext).toHaveBeenCalledTimes(1);
    expect(mocks.createVendors).toHaveBeenCalledTimes(1);
    expect(mocks.createRisks).toHaveBeenCalledTimes(1);
  });
});
