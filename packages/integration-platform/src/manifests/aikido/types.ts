/**
 * Aikido Security API Types
 *
 * These types match the Aikido REST API responses.
 * API Documentation: https://apidocs.aikido.dev/reference
 */

// ============================================================================
// Issue Types
// ============================================================================

export type AikidoSeverity = 'low' | 'medium' | 'high' | 'critical';

type AikidoIssueStatus = 'open' | 'ignored' | 'snoozed' | 'fixed';

type AikidoIssueType = 'dependency' | 'sast' | 'iac' | 'secrets' | 'container' | 'cloud' | 'dast';

interface AikidoIssueGroup {
  id: number;
  group_id?: number;
  rule: string;
  rule_id?: string;
  /** Numeric severity score (0-100) */
  severity: number;
  /** String severity level */
  severity_score: AikidoSeverity;
  status: AikidoIssueStatus;
  type: AikidoIssueType;
  attack_surface?: string;
  first_detected_at: number;
  affected_package?: string;
  affected_file?: string;
  code_repo_name?: string;
  code_repo_id?: number;
  container_repo_id?: number;
  container_repo_name?: string;
  start_line?: number;
  end_line?: number;
  cwe_classes?: string[];
  installed_version?: string;
  patched_versions?: string[];
  sla_days?: number;
  sla_remediate_by?: number;
  ignored_at?: number | null;
  ignored_by?: string | null;
  closed_at?: number | null;
  snooze_until?: number | null;
  license?: string | null;
  programming_language?: string;
}

/**
 * Severity breakdown with counts per level plus total
 */
export interface AikidoSeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
  all: number;
}

/**
 * Response from GET /issues/counts endpoint
 */
export interface AikidoIssueCounts {
  /** Counts grouped by issue group (deduplicated issues) */
  issue_groups: AikidoSeverityCounts;
  /** Counts of individual issues (may have multiple per group) */
  issues: AikidoSeverityCounts;
}

// ============================================================================
// Code Repository Types
// ============================================================================

export interface AikidoCodeRepository {
  /** Numeric ID from Aikido API */
  id: number;
  /** Repository name (e.g., "comp-new") */
  name: string;
  /** External repository ID from provider */
  external_repo_id?: string;
  /** Source control provider */
  provider: 'github' | 'gitlab' | 'bitbucket' | 'azure_devops';
  /** API URL to the repository */
  url?: string;
  /** Default branch name */
  branch?: string;
  /** Whether the repository is active in Aikido */
  active?: boolean;
  /** Unix timestamp of last scan */
  last_scanned_at?: number;
  /** Legacy fields for backwards compatibility */
  full_name?: string;
  is_active?: boolean;
  last_scan_at?: string;
  scan_status?: 'pending' | 'scanning' | 'completed' | 'failed';
  issues_count?: number;
  sensitivity?: 'low' | 'medium' | 'high';
  default_branch?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AikidoCodeRepositoriesResponse {
  repositories: AikidoCodeRepository[];
  total: number;
  page: number;
  per_page: number;
}

// ============================================================================
// Compliance Types
// ============================================================================

/**
 * Individual requirement check in the compliance report.
 * Status can be 'complying', 'not_complying', or 'not_applicable'.
 */
interface AikidoComplianceRequirement {
  title: string;
  status: 'complying' | 'not_complying' | 'not_applicable';
  type?: string;
}

/**
 * Group of requirements under a control criterion.
 * Groups are organized by type (e.g., "Protects unauthorized runtime access").
 */
interface AikidoComplianceGroup {
  type: string;
  requirements: AikidoComplianceRequirement[];
}

/**
 * Control criterion in the compliance framework (e.g., CC6.8 for SOC2).
 * Each control has a percentage score and groups of requirements.
 */
interface AikidoComplianceControl {
  id: string;
  title: string;
  percentage: number;
  warning?: string;
  groups: AikidoComplianceGroup[];
}

/**
 * Response from the SOC2/ISO27001 overview API endpoint.
 * Contains an array of control criteria with their compliance status.
 */
interface AikidoComplianceOverviewResponse {
  controls: AikidoComplianceControl[];
}

// ============================================================================
// Cloud Types
// ============================================================================

type AikidoCloudProvider = 'aws' | 'azure' | 'gcp' | 'kubernetes';

interface AikidoCloud {
  id: string;
  provider: AikidoCloudProvider;
  name: string;
  account_id?: string;
  subscription_id?: string;
  project_id?: string;
  status: 'connected' | 'disconnected' | 'error';
  issues_count: number;
  last_scan_at?: string;
  created_at: string;
}

// ============================================================================
// Container Types
// ============================================================================

interface AikidoContainer {
  id: string;
  name: string;
  image: string;
  tag?: string;
  registry?: string;
  is_active: boolean;
  issues_count: number;
  last_scan_at?: string;
  created_at: string;
}

// ============================================================================
// User Types
// ============================================================================

interface AikidoUser {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'member' | 'viewer';
  created_at: string;
}
