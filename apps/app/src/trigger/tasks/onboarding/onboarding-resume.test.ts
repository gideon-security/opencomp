import { beforeEach, describe, expect, it, vi } from 'vitest';

// Shared handles (vi.mock factories are hoisted — define fns via vi.hoisted).
const mocks = vi.hoisted(() => ({
  batchTrigger: vi.fn(),
  batchTriggerAndWait: vi.fn(),
  triggerAndWait: vi.fn(),
  metadataSet: vi.fn(),
  metadataIncrement: vi.fn(),
  metadataDecrement: vi.fn(),
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
  triggerPolicyUpdates: vi.fn(),
  findCommentAuthor: vi.fn(),
}));

vi.mock('@gideon-defender/trigger-local', () => ({
  task: vi.fn((config) => config),
  queue: vi.fn((config) => config),
  tags: { add: vi.fn() },
  metadata: {
    set: mocks.metadataSet,
    increment: mocks.metadataIncrement,
    decrement: mocks.metadataDecrement,
  },
  tasks: {
    trigger: vi.fn(),
    batchTrigger: mocks.batchTrigger,
    batchTriggerAndWait: mocks.batchTriggerAndWait,
    triggerAndWait: mocks.triggerAndWait,
  },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@db/server', () => ({
  VendorStatus: { not_assessed: 'not_assessed', in_progress: 'in_progress', assessed: 'assessed' },
  RiskStatus: { open: 'open', pending: 'pending', closed: 'closed', archived: 'archived' },
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
  findCommentAuthor: mocks.findCommentAuthor,
  createVendorRiskComment: vi.fn(),
  createRiskMitigationComment: vi.fn(),
}));

vi.mock('./trigger-policy-updates', () => ({
  triggerPolicyUpdates: mocks.triggerPolicyUpdates,
}));

vi.mock('../auditor/generate-auditor-content', () => ({
  generateAuditorContentTask: {},
}));

import { generateRiskMitigationsForOrg } from './generate-risk-mitigation';
import { generateVendorMitigationsForOrg } from './generate-vendor-mitigation';
import { onboardOrganization } from './onboard-organization';

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
      { id: 'v_1', treatmentStrategyDescription: 'Done plan', status: 'assessed' },
      { id: 'v_2', treatmentStrategyDescription: null, status: 'not_assessed' },
      { id: 'v_3', treatmentStrategyDescription: '  ', status: 'not_assessed' },
    ]);
    mocks.policyFindMany.mockResolvedValue([]);

    await vendorFanout.run({ organizationId: ORG });

    expect(mocks.batchTriggerAndWait).toHaveBeenCalledTimes(1);
    const items = mocks.batchTriggerAndWait.mock.calls[0][1] as Array<{
      payload: { vendorId: string };
    }>;
    expect(items.map((i) => i.payload.vendorId).sort()).toEqual(['v_2', 'v_3']);
    expect(mocks.metadataSet).toHaveBeenCalledWith('vendorsTotal', 3);
    expect(mocks.metadataSet).toHaveBeenCalledWith('vendorsCompleted', 1);
    expect(mocks.metadataSet).toHaveBeenCalledWith('vendorsRemaining', 2);
    expect(mocks.metadataSet).toHaveBeenCalledWith('vendor_v_1_status', 'completed');
    expect(mocks.metadataIncrement).not.toHaveBeenCalled();
    expect(mocks.metadataDecrement).not.toHaveBeenCalled();
  });

  it('re-runs a vendor with a plan but no assessed status — the status write was lost', async () => {
    // The plan write lands before the status write. A crash between them
    // leaves a plan with a stale status; the retry must heal it, not skip it.
    mocks.vendorFindMany.mockResolvedValue([
      { id: 'v_1', treatmentStrategyDescription: 'Done plan', status: 'not_assessed' },
    ]);
    mocks.policyFindMany.mockResolvedValue([]);

    await vendorFanout.run({ organizationId: ORG });

    expect(mocks.batchTriggerAndWait).toHaveBeenCalledTimes(1);
    const items = mocks.batchTriggerAndWait.mock.calls[0][1] as Array<{
      payload: { vendorId: string };
    }>;
    expect(items.map((i) => i.payload.vendorId)).toEqual(['v_1']);
    expect(mocks.metadataIncrement).not.toHaveBeenCalled();
  });

  it('fires no batch when every vendor is already mitigated', async () => {
    mocks.vendorFindMany.mockResolvedValue([
      { id: 'v_1', treatmentStrategyDescription: 'Done plan', status: 'assessed' },
    ]);
    mocks.policyFindMany.mockResolvedValue([]);

    await vendorFanout.run({ organizationId: ORG });

    expect(mocks.batchTriggerAndWait).not.toHaveBeenCalled();
    expect(mocks.metadataSet).toHaveBeenCalledWith('vendorsTotal', 1);
    expect(mocks.metadataSet).toHaveBeenCalledWith('vendorsCompleted', 1);
    expect(mocks.metadataSet).toHaveBeenCalledWith('vendorsRemaining', 0);
  });
});

describe('risk mitigation fan-out resume', () => {
  it('batches only risks without a written mitigation plan', async () => {
    mocks.riskFindMany.mockResolvedValue([
      { id: 'r_1', treatmentStrategyDescription: 'Done plan', status: 'pending' },
      { id: 'r_2', treatmentStrategyDescription: null, status: 'open' },
      { id: 'r_3', treatmentStrategyDescription: '  ', status: 'open' },
    ]);
    mocks.policyFindMany.mockResolvedValue([]);

    await riskFanout.run({ organizationId: ORG });

    expect(mocks.batchTriggerAndWait).toHaveBeenCalledTimes(1);
    const items = mocks.batchTriggerAndWait.mock.calls[0][1] as Array<{
      payload: { riskId: string };
    }>;
    expect(items.map((i) => i.payload.riskId).sort()).toEqual(['r_2', 'r_3']);
    expect(mocks.metadataSet).toHaveBeenCalledWith('risksTotal', 3);
    expect(mocks.metadataSet).toHaveBeenCalledWith('risksCompleted', 1);
    expect(mocks.metadataSet).toHaveBeenCalledWith('risksRemaining', 2);
    expect(mocks.metadataSet).toHaveBeenCalledWith('risk_r_1_status', 'completed');
    expect(mocks.metadataIncrement).not.toHaveBeenCalled();
    expect(mocks.metadataDecrement).not.toHaveBeenCalled();
  });

  it('re-runs a risk with a plan but still open — the status write was lost', async () => {
    mocks.riskFindMany.mockResolvedValue([
      { id: 'r_1', treatmentStrategyDescription: 'Done plan', status: 'open' },
    ]);
    mocks.policyFindMany.mockResolvedValue([]);

    await riskFanout.run({ organizationId: ORG });

    expect(mocks.batchTriggerAndWait).toHaveBeenCalledTimes(1);
    const items = mocks.batchTriggerAndWait.mock.calls[0][1] as Array<{
      payload: { riskId: string };
    }>;
    expect(items.map((i) => i.payload.riskId)).toEqual(['r_1']);
    expect(mocks.metadataIncrement).not.toHaveBeenCalled();
  });

  it('fires no batch when every risk is already mitigated', async () => {
    mocks.riskFindMany.mockResolvedValue([
      { id: 'r_1', treatmentStrategyDescription: 'Done plan', status: 'pending' },
    ]);
    mocks.policyFindMany.mockResolvedValue([]);

    await riskFanout.run({ organizationId: ORG });

    expect(mocks.batchTriggerAndWait).not.toHaveBeenCalled();
    expect(mocks.metadataSet).toHaveBeenCalledWith('risksTotal', 1);
    expect(mocks.metadataSet).toHaveBeenCalledWith('risksCompleted', 1);
    expect(mocks.metadataSet).toHaveBeenCalledWith('risksRemaining', 0);
  });
});

describe('onboard-organization extraction resume', () => {
  function mockOrgState() {
    mocks.frameworkInstanceFindMany.mockResolvedValue([]);
    mocks.memberFindFirst.mockResolvedValue({ id: 'mem_owner' });
    mocks.frameworkEditorFrameworkFindMany.mockResolvedValue([]);
    mocks.onboardingUpdate.mockResolvedValue({});
  }

  it('re-runs extraction on retry so partial sets heal instead of freezing', async () => {
    // The orchestrator must not skip extraction when rows already exist —
    // skipping on any-row-exists would freeze a partial set after a
    // mid-creation crash. Healing itself lives in the create helpers
    // (mocked here, covered by their own unit tests); this locks in the
    // no-skip contract at the orchestrator level.
    mockOrgState();
    mocks.extractVendorsFromContext.mockResolvedValue([]);
    mocks.createVendors.mockResolvedValue([]);
    mocks.createRisks.mockResolvedValue([]);

    await onboardRun.run({ organizationId: ORG });

    expect(mocks.extractVendorsFromContext).toHaveBeenCalledTimes(1);
    expect(mocks.createVendors).toHaveBeenCalledTimes(1);
    expect(mocks.createRisks).toHaveBeenCalledTimes(1);
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
