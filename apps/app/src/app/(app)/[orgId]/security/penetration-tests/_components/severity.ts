import type { IssueSeverity } from '@/lib/security/penetration-tests-client';

/**
 * Severity ordering (critical first). Used for sorts + rollup tallies.
 */
export const SEVERITY_ORDER: readonly IssueSeverity[] = [
  'critical',
  'high',
  'medium',
  'low',
  'info',
] as const;

export const SEVERITY_INDEX: Record<IssueSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export const SEVERITY_BG_VAR: Record<IssueSeverity, string> = {
  critical: 'var(--pt-sev-critical-bg)',
  high: 'var(--pt-sev-high-bg)',
  medium: 'var(--pt-sev-medium-bg)',
  low: 'var(--pt-sev-low-bg)',
  info: 'var(--pt-sev-info-bg)',
};

export const SEVERITY_FG_VAR: Record<IssueSeverity, string> = {
  critical: 'var(--pt-sev-critical-fg)',
  high: 'var(--pt-sev-high-fg)',
  medium: 'var(--pt-sev-medium-fg)',
  low: 'var(--pt-sev-low-fg)',
  info: 'var(--pt-sev-info-fg)',
};

export const SEVERITY_BAR_VAR: Record<IssueSeverity, string> = {
  critical: 'var(--pt-sev-critical-bar)',
  high: 'var(--pt-sev-high-bar)',
  medium: 'var(--pt-sev-medium-bar)',
  low: 'var(--pt-sev-low-bar)',
  info: 'var(--pt-sev-info-bar)',
};

export const SEVERITY_LABEL: Record<IssueSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
};

/**
 * Tally the number of findings at each severity level. Returns all five
 * buckets so the UI can render a fixed-size row without null checks.
 */
export function tallySeverities<T extends { severity: IssueSeverity }>(
  items: readonly T[],
): Record<IssueSeverity, number> {
  const tally: Record<IssueSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const item of items) {
    tally[item.severity] = (tally[item.severity] ?? 0) + 1;
  }
  return tally;
}

/**
 * Map of terminal vs. in-progress statuses. Keeps the split-view detail
 * router pure: `statusToView(run.status)` picks which detail pane renders.
 */
type RunStatus = 'provisioning' | 'cloning' | 'running' | 'completed' | 'failed' | 'cancelled';

export function isRunInProgress(status: RunStatus | string | undefined): boolean {
  return status === 'provisioning' || status === 'cloning' || status === 'running';
}
