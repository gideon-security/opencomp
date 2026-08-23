/**
 * Stub for @db and @gideon-defender/db — returns a Proxy-based mockDb.
 * Any table / method access returns a jest.fn() so untouched entities
 * don't crash with "cannot read properties of undefined". Tests that need
 * specific return values still should override with their own jest.mock().
 */
function createTableMock() {
  return new Proxy(
    {},
    {
      get: () => jest.fn(),
    },
  );
}

export const db: Record<string, unknown> = new Proxy(
  {},
  {
    get: () => createTableMock(),
  },
);

export const Prisma = {
  // Error classes referenced via `instanceof` across services.
  PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
    code: string;
    constructor(message: string, { code }: { code: string }) {
      super(message);
      this.code = code;
    }
  },
  PrismaClientInitializationError: class PrismaClientInitializationError extends Error {},
  PrismaClientUnknownRequestError: class PrismaClientUnknownRequestError extends Error {},
  PrismaClientRustPanicError: class PrismaClientRustPanicError extends Error {},
  PrismaClientValidationError: class PrismaClientValidationError extends Error {},
};
/**
 * Generated from packages/db/prisma/schema — string-enum mirrors so DTOs
 * and services importing value-level enums from '@db' work under jest.
 * Regenerate after adding enums to the schema.
 */
export const AttachmentEntityType = { task: 'task', vendor: 'vendor', risk: 'risk', comment: 'comment', trust_nda: 'trust_nda', task_item: 'task_item', background_check: 'background_check', employment_onboard: 'employment_onboard', employment_offboard: 'employment_offboard', offboarding_checklist: 'offboarding_checklist' } as const;
export const AttachmentType = { image: 'image', video: 'video', audio: 'audio', document: 'document', other: 'other' } as const;
export const AuditLogEntityType = { organization: 'organization', framework: 'framework', requirement: 'requirement', control: 'control', policy: 'policy', task: 'task', people: 'people', risk: 'risk', vendor: 'vendor', tests: 'tests', integration: 'integration', trust: 'trust', finding: 'finding', pentest: 'pentest' } as const;
export const BackgroundCheckStatus = { invited: 'invited', in_progress: 'in_progress', in_review: 'in_review', completed: 'completed', completed_with_flags: 'completed_with_flags', failed: 'failed', cancelled: 'cancelled' } as const;
export const BrowserAuthProfileStatus = { unverified: 'unverified', verified: 'verified', needs_reauth: 'needs_reauth', blocked: 'blocked' } as const;
export const BrowserAutomationEvaluationStatus = { pass: 'pass', fail: 'fail' } as const;
export const BrowserAutomationFailureCode = { needs_reauth: 'needs_reauth', needs_user_action: 'needs_user_action', rate_limited: 'rate_limited', captcha_blocked: 'captcha_blocked', timeout: 'timeout', browser_session_lost: 'browser_session_lost', evaluation_failed: 'evaluation_failed', unknown: 'unknown' } as const;
export const BrowserAutomationFailureStage = { auth: 'auth', navigation: 'navigation', action: 'action', screenshot: 'screenshot', evaluation: 'evaluation', upload: 'upload', session: 'session', unknown: 'unknown' } as const;
export const BrowserAutomationRunStatus = { pending: 'pending', running: 'running', completed: 'completed', failed: 'failed', blocked: 'blocked' } as const;
export const CommentEntityType = { task: 'task', vendor: 'vendor', risk: 'risk', policy: 'policy', finding: 'finding' } as const;
export const Departments = { none: 'none', admin: 'admin', gov: 'gov', hr: 'hr', it: 'it', itsm: 'itsm', qms: 'qms' } as const;
export const DevicePlatform = { macos: 'macos', windows: 'windows', linux: 'linux' } as const;
export const DeviceSource = { agent: 'agent', fleet: 'fleet', integration: 'integration' } as const;
export const EvidenceAutomationEvaluationStatus = { pass: 'pass', fail: 'fail' } as const;
export const EvidenceAutomationRunStatus = { pending: 'pending', running: 'running', completed: 'completed', failed: 'failed', cancelled: 'cancelled' } as const;
export const EvidenceAutomationTrigger = { manual: 'manual', scheduled: 'scheduled', api: 'api' } as const;
export const EvidenceFormType = { board_meeting: 'board_meeting', it_leadership_meeting: 'it_leadership_meeting', risk_committee_meeting: 'risk_committee_meeting', meeting: 'meeting', access_request: 'access_request', whistleblower_report: 'whistleblower_report', penetration_test: 'penetration_test', rbac_matrix: 'rbac_matrix', infrastructure_inventory: 'infrastructure_inventory', employee_performance_evaluation: 'employee_performance_evaluation', network_diagram: 'network_diagram', tabletop_exercise: 'tabletop_exercise', account_types: 'account_types' } as const;
export const FindingArea = { people: 'people', documents: 'documents', compliance: 'compliance', risks: 'risks', vendors: 'vendors', policies: 'policies', other: 'other' } as const;
export const FindingResolutionMethod = { platform_fix: 'platform_fix', external_fix: 'external_fix', resource_deleted: 'resource_deleted', exception_marked: 'exception_marked' } as const;
export const FindingSeverity = { low: 'low', medium: 'medium', high: 'high', critical: 'critical' } as const;
export const FindingStatus = { open: 'open', ready_for_review: 'ready_for_review', needs_revision: 'needs_revision', closed: 'closed' } as const;
export const FindingType = { soc2: 'soc2', iso27001: 'iso27001', pci_dss: 'pci_dss', hipaa: 'hipaa', gdpr: 'gdpr', iso9001: 'iso9001', iso42001: 'iso42001' } as const;
export const FrameworkEditorFrameworkFamilyStatus = { visible: 'visible', hidden: 'hidden', under_construction: 'under_construction', partial: 'partial' } as const;
export const FrameworkStatus = { started: 'started', in_progress: 'in_progress', compliant: 'compliant' } as const;
export const FrameworkSyncOperationKind = { SYNC: 'SYNC', ROLLBACK: 'ROLLBACK' } as const;
export const Frequency = { monthly: 'monthly', quarterly: 'quarterly', yearly: 'yearly' } as const;
export const Impact = { insignificant: 'insignificant', minor: 'minor', moderate: 'moderate', major: 'major', severe: 'severe' } as const;
export const IntegrationConnectionStatus = { pending: 'pending', active: 'active', error: 'error', paused: 'paused', disconnected: 'disconnected' } as const;
export const IntegrationFindingSeverity = { info: 'info', low: 'low', medium: 'medium', high: 'high', critical: 'critical' } as const;
export const IntegrationFindingStatus = { open: 'open', resolved: 'resolved', ignored: 'ignored' } as const;
export const IntegrationRunJobType = { full_sync: 'full_sync', delta_sync: 'delta_sync', webhook: 'webhook', manual: 'manual', test_connection: 'test_connection' } as const;
export const IntegrationRunStatus = { pending: 'pending', running: 'running', success: 'success', failed: 'failed', cancelled: 'cancelled', inconclusive: 'inconclusive' } as const;
export const IntegrationSyncLogStatus = { pending: 'pending', running: 'running', success: 'success', failed: 'failed' } as const;
export const IsmsAuditConclusionVerdict = { conform: 'conform', substantially_conform: 'substantially_conform', not_yet_conform: 'not_yet_conform' } as const;
export const IsmsAuditControlResult = { conformity_confirmed: 'conformity_confirmed', nonconformity_raised: 'nonconformity_raised', observation_raised: 'observation_raised', not_sampled: 'not_sampled' } as const;
export const IsmsAuditFindingStatus = { open: 'open', in_progress: 'in_progress', closed: 'closed' } as const;
export const IsmsAuditFindingType = { nc_major: 'nc_major', nc_minor: 'nc_minor', ofi: 'ofi', observation: 'observation' } as const;
export const IsmsAuditRoute = { in_house: 'in_house', external: 'external', training_planned: 'training_planned' } as const;
export const IsmsAuditStatus = { planned: 'planned', in_progress: 'in_progress', complete: 'complete' } as const;
export const IsmsCompetenceBasis = { education: 'education', training: 'training', experience: 'experience', combination: 'combination' } as const;
export const IsmsContextIssueKind = { internal: 'internal', external: 'external' } as const;
export const IsmsContextSource = { derived: 'derived', manual: 'manual' } as const;
export const IsmsDocumentStatus = { draft: 'draft', in_progress: 'in_progress', needs_review: 'needs_review', approved: 'approved', declined: 'declined' } as const;
export const IsmsDocumentType = { context_of_organization: 'context_of_organization', interested_parties_register: 'interested_parties_register', interested_parties_requirements: 'interested_parties_requirements', isms_scope: 'isms_scope', leadership_commitment: 'leadership_commitment', roles_and_responsibilities: 'roles_and_responsibilities', risk_assessment_methodology: 'risk_assessment_methodology', risk_treatment_plan: 'risk_treatment_plan', objectives_plan: 'objectives_plan', monitoring: 'monitoring', internal_audit: 'internal_audit', management_review: 'management_review' } as const;
export const IsmsMetricCadence = { monthly: 'monthly', quarterly: 'quarterly' } as const;
export const IsmsObjectiveStatus = { not_started: 'not_started', on_track: 'on_track', at_risk: 'at_risk', met: 'met' } as const;
export const IsmsReviewActionStatus = { open: 'open', in_progress: 'in_progress', closed: 'closed' } as const;
export const IsmsReviewConclusionVerdict = { suitable: 'suitable', adequate: 'adequate', effective: 'effective' } as const;
export const IsmsReviewStatus = { planned: 'planned', in_progress: 'in_progress', complete: 'complete' } as const;
export const KnowledgeBaseDocumentProcessingStatus = { pending: 'pending', processing: 'processing', completed: 'completed', failed: 'failed' } as const;
export const Likelihood = { very_unlikely: 'very_unlikely', unlikely: 'unlikely', possible: 'possible', likely: 'likely', very_likely: 'very_likely' } as const;
export const PhaseCompletionType = { AUTO_TASKS: 'AUTO_TASKS', AUTO_POLICIES: 'AUTO_POLICIES', AUTO_PEOPLE: 'AUTO_PEOPLE', AUTO_FINDINGS: 'AUTO_FINDINGS', AUTO_UPLOAD: 'AUTO_UPLOAD', MANUAL: 'MANUAL' } as const;
export const PolicyDisplayFormat = { EDITOR: 'EDITOR', PDF: 'PDF' } as const;
export const PolicyStatus = { draft: 'draft', published: 'published', needs_review: 'needs_review' } as const;
export const PolicyVisibility = { ALL: 'ALL', DEPARTMENT: 'DEPARTMENT' } as const;
export const QuestionnaireAnswerStatus = { untouched: 'untouched', generated: 'generated', manual: 'manual' } as const;
export const QuestionnaireStatus = { parsing: 'parsing', completed: 'completed', failed: 'failed' } as const;
export const RiskCategory = { customer: 'customer', fraud: 'fraud', governance: 'governance', operations: 'operations', other: 'other', people: 'people', regulatory: 'regulatory', reporting: 'reporting', resilience: 'resilience', technology: 'technology', vendor_management: 'vendor_management' } as const;
export const RiskStatus = { open: 'open', pending: 'pending', closed: 'closed', archived: 'archived' } as const;
export const RiskTreatmentType = { accept: 'accept', avoid: 'avoid', mitigate: 'mitigate', transfer: 'transfer' } as const;
export const Role = { owner: 'owner', admin: 'admin', auditor: 'auditor', employee: 'employee', contractor: 'contractor' } as const;
export const SOAAnswerStatus = { untouched: 'untouched', generated: 'generated', manual: 'manual' } as const;
export const SOADocumentStatus = { draft: 'draft', in_progress: 'in_progress', needs_review: 'needs_review', completed: 'completed' } as const;
export const TaskAutomationStatus = { AUTOMATED: 'AUTOMATED', MANUAL: 'MANUAL' } as const;
export const TaskFrequency = { daily: 'daily', weekly: 'weekly', monthly: 'monthly', quarterly: 'quarterly', yearly: 'yearly' } as const;
export const TaskItemEntityType = { vendor: 'vendor', risk: 'risk' } as const;
export const TaskItemPriority = { urgent: 'urgent', high: 'high', medium: 'medium', low: 'low' } as const;
export const TaskItemStatus = { todo: 'todo', in_progress: 'in_progress', in_review: 'in_review', done: 'done', canceled: 'canceled' } as const;
export const TaskStatus = { todo: 'todo', in_progress: 'in_progress', in_review: 'in_review', done: 'done', not_relevant: 'not_relevant', failed: 'failed' } as const;
export const TimelinePhaseStatus = { PENDING: 'PENDING', IN_PROGRESS: 'IN_PROGRESS', COMPLETED: 'COMPLETED' } as const;
export const TimelineStatus = { DRAFT: 'DRAFT', ACTIVE: 'ACTIVE', PAUSED: 'PAUSED', COMPLETED: 'COMPLETED' } as const;
export const TrustAccessGrantStatus = { active: 'active', expired: 'expired', revoked: 'revoked' } as const;
export const TrustAccessRequestStatus = { under_review: 'under_review', approved: 'approved', denied: 'denied', canceled: 'canceled' } as const;
export const TrustFramework = { iso_27001: 'iso_27001', iso_42001: 'iso_42001', gdpr: 'gdpr', hipaa: 'hipaa', soc2_type1: 'soc2_type1', soc2_type2: 'soc2_type2', soc3: 'soc3', pci_dss: 'pci_dss', nen_7510: 'nen_7510', iso_9001: 'iso_9001', pipeda: 'pipeda', ccpa: 'ccpa' } as const;
export const TrustNDAStatus = { pending: 'pending', signed: 'signed', void: 'void' } as const;
export const TrustStatus = { draft: 'draft', published: 'published' } as const;
export const VendorCategory = { cloud: 'cloud', infrastructure: 'infrastructure', software_as_a_service: 'software_as_a_service', finance: 'finance', marketing: 'marketing', sales: 'sales', hr: 'hr', other: 'other' } as const;
export const VendorStatus = { not_assessed: 'not_assessed', in_progress: 'in_progress', assessed: 'assessed' } as const;
