'use client';

import { apiClient } from '@/lib/api-client';
import { createSimpleListHook } from './create-entity-hooks';

interface TimelinePhase {
  id: string;
  name: string;
  description: string | null;
  groupLabel?: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  durationWeeks: number;
  orderIndex: number;
  startDate: string | null;
  endDate: string | null;
  completedAt: string | null;
  completionType:
    'AUTO_TASKS' | 'AUTO_POLICIES' | 'AUTO_PEOPLE' | 'AUTO_FINDINGS' | 'AUTO_UPLOAD' | 'MANUAL';
  completionPercent?: number;
  readyForReview: boolean;
  readyForReviewAt: string | null;
}

interface Timeline {
  id: string;
  organizationId: string;
  frameworkInstanceId: string;
  templateId: string;
  cycleNumber: number;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  startDate: string | null;
  pausedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  phases: TimelinePhase[];
  frameworkInstance?: {
    id: string;
    framework: {
      id: string;
      name: string;
    };
  };
  template?: {
    id: string;
    name: string;
    cycleNumber: number;
  };
}

interface TimelinesApiResponse {
  data: Timeline[];
  count: number;
}

const useTimelinesList = createSimpleListHook<Timeline, TimelinesApiResponse>('/v1/timelines');

interface UseTimelinesOptions {
  initialData?: Timeline[];
}

export function useTimelines(options?: UseTimelinesOptions) {
  const { initialData } = options ?? {};
  const { data, error, isLoading, mutate } = useTimelinesList({ initialData });
  const timelines = Array.isArray(data) ? data : [];
  return {
    timelines,
    isLoading,
    error,
    mutate,
  };
}

export async function markPhaseReadyForReview({
  timelineId,
  phaseId,
}: {
  timelineId: string;
  phaseId: string;
}) {
  const response = await apiClient.post(`/v1/timelines/${timelineId}/phases/${phaseId}/ready`);
  if (response.error) throw new Error(response.error);
  return response.data;
}

export type { Timeline, TimelinePhase };
