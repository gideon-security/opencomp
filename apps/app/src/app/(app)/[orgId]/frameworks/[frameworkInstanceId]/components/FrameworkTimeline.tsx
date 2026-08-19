'use client';

import { Badge, Button, Heading, Text } from '@trycompai/design-system';
import {
  CheckmarkFilled,
  CircleFilled,
  CircleDash,
  Time,
} from '@trycompai/design-system/icons';
import { useFeatureFlag } from '@gideon-defender/analytics';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  useTimelines,
  markPhaseReadyForReview,
  type Timeline,
  type TimelinePhase,
} from '@/hooks/use-timelines';
import { TimelinePhaseBar } from '../../../overview/components/TimelinePhaseBar';

interface FrameworkTimelineProps {
  frameworkInstanceId: string;
}

function formatDate(date: string | Date | null): string {
  if (!date) return '\u2014';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

type TimeRemaining =
  | { status: 'overdue' }
  | { status: 'days'; count: number }
  | { status: 'weeks'; count: number };

function getTimeRemaining(endDate: string | null): TimeRemaining | null {
  if (!endDate) return null;
  const now = new Date();
  const end = new Date(endDate);
  const diffMs = end.getTime() - now.getTime();
  if (diffMs <= 0) return { status: 'overdue' };
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 1) return { status: 'days', count: 1 };
  if (diffDays < 7) return { status: 'days', count: diffDays };
  const diffWeeks = Math.ceil(diffDays / 7);
  if (diffWeeks === 1) return { status: 'weeks', count: 1 };
  return { status: 'weeks', count: diffWeeks };
}

export function FrameworkTimeline({
  frameworkInstanceId,
}: FrameworkTimelineProps) {
  const t = useTranslations('frameworks');
  const isTimelineEnabled = useFeatureFlag('is-timeline-enabled');
  const { timelines } = useTimelines();

  if (!isTimelineEnabled) return null;

  const timeline = timelines.find(
    (tl) => tl.frameworkInstanceId === frameworkInstanceId,
  );

  if (!timeline || timeline.phases.length === 0) return null;

  const sortedPhases = [...timeline.phases].sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );

  const currentPhase = sortedPhases.find((p) => p.status === 'IN_PROGRESS');
  const currentPhaseIndex = currentPhase
    ? sortedPhases.indexOf(currentPhase) + 1
    : timeline.status === 'COMPLETED'
      ? sortedPhases.length
      : 0;
  const lastPhase = sortedPhases[sortedPhases.length - 1];
  const estCompletion = lastPhase?.endDate
    ? formatDate(lastPhase.endDate)
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <Heading level="2">{t('instance.complianceTimeline')}</Heading>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {currentPhaseIndex > 0 && (
            <span>
              {t('instance.phaseXOfY', {
                current: currentPhaseIndex,
                total: sortedPhases.length,
              })}
              {currentPhase && (
                <span className="ml-1 font-medium text-foreground">
                  · {currentPhase.name}
                </span>
              )}
            </span>
          )}
          {estCompletion && timeline.status !== 'COMPLETED' && (
            <span>· {t('instance.estCompletion', { date: estCompletion })}</span>
          )}
          {timeline.status === 'COMPLETED' && timeline.completedAt && (
            <span className="text-primary">
              {t('instance.completedOn', { date: formatDate(timeline.completedAt) })}
            </span>
          )}
        </div>
      </div>
      <TimelinePhaseBar phases={sortedPhases} showDates />
      <div className="flex flex-col gap-3">
        {sortedPhases.map((phase) => (
          <PhaseCard
            key={phase.id}
            phase={phase}
            timeline={timeline}
          />
        ))}
      </div>
    </div>
  );
}

function PhaseCard({
  phase,
  timeline,
}: {
  phase: TimelinePhase;
  timeline: Timeline;
}) {
  const [markingReady, setMarkingReady] = useState(false);
  const [markedReady, setMarkedReady] = useState(false);
  const t = useTranslations('frameworks');
  const { mutate } = useTimelines();

  const isCompleted = phase.status === 'COMPLETED';
  const isActive = phase.status === 'IN_PROGRESS';

  const showReadyButton =
    isActive &&
    phase.completionType === 'AUTO_TASKS' &&
    !phase.readyForReview &&
    !markedReady;

  const handleMarkReady = async () => {
    setMarkingReady(true);
    try {
      await markPhaseReadyForReview({
        timelineId: timeline.id,
        phaseId: phase.id,
      });
      setMarkedReady(true);
      await mutate();
    } catch {
      // Allow retry on failure
    } finally {
      setMarkingReady(false);
    }
  };

  const borderClass = isCompleted
    ? 'border-primary/30 bg-primary/5'
    : isActive
      ? 'border-primary/50 bg-primary/10'
      : 'border-border bg-muted/30 opacity-70';

  return (
    <div
      className={`rounded-lg border p-4 ${borderClass}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <StatusIcon status={phase.status} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{phase.name}</span>
            <StatusBadge status={phase.status} />
          </div>
          {phase.description && (
            <div>
              <Text size="sm" variant="muted">
                {phase.description}
              </Text>
            </div>
          )}
          <PhaseMetadata phase={phase} />
          {(markedReady || phase.readyForReview) && (
            <div className="mt-2 flex items-center gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-xs text-primary">
              <CheckmarkFilled size={14} />
              <span>{t('instance.markedReadyForReview')}</span>
            </div>
          )}
        </div>
        {showReadyButton && (
          <div className="shrink-0">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleMarkReady}
              loading={markingReady}
            >
              {t('instance.markReadyForReview')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: TimelinePhase['status'] }) {
  if (status === 'COMPLETED') {
    return <CheckmarkFilled size={20} className="text-primary" />;
  }
  if (status === 'IN_PROGRESS') {
    return (
      <div className="relative flex h-5 w-5 items-center justify-center">
        <div className="absolute h-3 w-3 animate-ping rounded-full bg-primary opacity-30" />
        <CircleFilled size={20} className="text-primary" />
      </div>
    );
  }
  return <CircleDash size={20} className="text-muted-foreground" />;
}

function StatusBadge({ status }: { status: TimelinePhase['status'] }) {
  const t = useTranslations('frameworks');
  const tCommon = useTranslations('overview');
  if (status === 'COMPLETED') {
    return <Badge variant="default">{tCommon('common.completed')}</Badge>;
  }
  if (status === 'IN_PROGRESS') {
    return <Badge variant="secondary">{t('instance.inProgress')}</Badge>;
  }
  return <Badge variant="secondary">{t('instance.pending')}</Badge>;
}

function PhaseMetadata({ phase }: { phase: TimelinePhase }) {
  const t = useTranslations('frameworks');
  const tCommon = useTranslations('overview');
  const isCompleted = phase.status === 'COMPLETED';
  const isActive = phase.status === 'IN_PROGRESS';
  const isPending = phase.status === 'PENDING';
  const timeRemaining = getTimeRemaining(phase.endDate);

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <Time size={12} />
        {t('instance.weekDuration', { count: phase.durationWeeks })}
      </span>
      {isCompleted && phase.completedAt && (
        <span>{t('instance.completedOn', { date: formatDate(phase.completedAt) })}</span>
      )}
      {isCompleted && phase.startDate && phase.endDate && (
        <span>
          {formatDate(phase.startDate)} &ndash; {formatDate(phase.endDate)}
        </span>
      )}
      {isActive && (
        <>
          {phase.startDate && (
            <span>{t('instance.startedOn', { date: formatDate(phase.startDate) })}</span>
          )}
          {phase.endDate && (
            <span>{t('instance.dueOn', { date: formatDate(phase.endDate) })}</span>
          )}
          {timeRemaining && (
            <span className="font-medium text-primary">
              {timeRemaining.status === 'overdue'
                ? tCommon('common.overdue')
                : timeRemaining.status === 'days'
                  ? t('instance.timeRemainingDays', { count: timeRemaining.count })
                  : t('instance.timeRemainingWeeks', { count: timeRemaining.count })}
            </span>
          )}
        </>
      )}
      {isPending && phase.startDate && (
        <span>{t('instance.estDate', { date: formatDate(phase.startDate) })}</span>
      )}
      {isPending && phase.endDate && (
        <span>{t('instance.estDate', { date: formatDate(phase.endDate) })}</span>
      )}
    </div>
  );
}
