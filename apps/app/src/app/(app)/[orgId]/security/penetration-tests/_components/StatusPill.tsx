import { cn } from '@trycompai/design-system/cn';
import { useTranslations } from 'next-intl';

type StatusKind =
  | 'provisioning'
  | 'cloning'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

interface StatusPillProps {
  status: StatusKind | string;
  /**
   * @deprecated retained for prop compatibility. Was used to promote
   * `completed` runs to a "clean" pill, but the sidebar list can't compute
   * the same value (no per-run issue counts in the list endpoint), which
   * led to the detail view saying "CLEAN" while the sidebar said
   * "COMPLETED" for the same run. The promotion is dropped — the hero
   * headline ("No findings reported in this scan") already carries the
   * success cue.
   */
  findingCount?: number;
  className?: string;
}

const STATUS_CONFIG: Record<StatusKind, { dotClass: string; textClass: string }> = {
  provisioning: {
    dotClass: 'bg-muted-foreground animate-pulse',
    textClass: 'text-muted-foreground',
  },
  cloning: {
    dotClass: 'bg-muted-foreground animate-pulse',
    textClass: 'text-muted-foreground',
  },
  running: {
    dotClass: 'bg-[var(--pt-pulse)] animate-pulse',
    textClass: 'text-foreground',
  },
  completed: {
    dotClass: 'bg-primary',
    textClass: 'text-foreground',
  },
  failed: {
    dotClass: 'bg-destructive',
    textClass: 'text-destructive',
  },
  cancelled: {
    dotClass: 'bg-muted-foreground',
    textClass: 'text-muted-foreground',
  },
};

// Fallback for status values we don't know how to render. Better to
// show "Unknown" than to silently render an unrelated status (e.g.
// previously this defaulted to "Provisioning", which would mislead
// users into thinking the scan was still starting up).
const CONFIG_UNKNOWN: { dotClass: string; textClass: string } = {
  dotClass: 'bg-muted-foreground',
  textClass: 'text-muted-foreground',
};

export function StatusPill({ status, className }: StatusPillProps) {
  const t = useTranslations('security');
  const config = STATUS_CONFIG[status as StatusKind] ?? CONFIG_UNKNOWN;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5',
        'text-[10px] font-bold uppercase tracking-[0.08em]',
        config.textClass,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dotClass)} />
      {statusLabel(t, status)}
    </span>
  );
}

function statusLabel(
  t: ReturnType<typeof useTranslations<'security'>>,
  status: StatusKind | string,
): string {
  switch (status) {
    case 'provisioning':
      return t('penTest.status.provisioning');
    case 'cloning':
      return t('penTest.status.cloning');
    case 'running':
      return t('penTest.status.running');
    case 'completed':
      return t('penTest.status.completed');
    case 'failed':
      return t('penTest.status.failed');
    case 'cancelled':
      return t('penTest.status.cancelled');
    default:
      return t('penTest.status.unknown');
  }
}
