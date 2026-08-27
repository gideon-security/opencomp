'use client';

import { useApiSWR, UseApiSWROptions } from '@/hooks/use-api-swr';
import { ApiResponse } from '@/lib/api-client';
import { createEntityHooks, createLinkageActions, DEFAULT_POLLING_INTERVAL } from './create-entity-hooks';
import { useApi } from '@/hooks/use-api';
import type {
  Impact,
  Likelihood,
  RiskCategory,
  RiskStatus,
  RiskTreatmentType,
  TaskStatus,
} from '@db';
import { useCallback, useMemo } from 'react';

export interface RiskLinkedTask {
  id: string;
  title: string;
  status: TaskStatus;
  controls: { id: string; name: string }[];
}

const riskHooks = createEntityHooks<Risk, RisksResponse, CreateRiskData, UpdateRiskData>({
  basePath: '/v1/risks',
});
const riskLinkage = createLinkageActions('risks');

export interface RiskAssignee {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

export interface Risk {
  id: string;
  title: string;
  description: string;
  category: RiskCategory;
  department: string | null;
  status: RiskStatus;
  likelihood: Likelihood;
  impact: Impact;
  residualLikelihood: Likelihood;
  residualImpact: Impact;
  treatmentStrategyDescription: string | null;
  treatmentStrategy: RiskTreatmentType;
  organizationId: string;
  assigneeId: string | null;
  assignee?: RiskAssignee | null;
  tasks?: RiskLinkedTask[];
  createdAt: string;
  updatedAt: string;
}

interface RisksResponse {
  data: Risk[];
  totalCount: number;
  page: number;
  pageCount: number;
}

export interface RisksQueryParams {
  title?: string;
  page?: number;
  perPage?: number;
  sort?: string;
  sortDirection?: 'asc' | 'desc';
  status?: string;
  category?: string;
  department?: string;
  assigneeId?: string;
}

/**
 * Risk response from API - same as Risk for now
 */
export type RiskResponse = Risk;

interface CreateRiskData {
  title: string;
  description?: string;
  category?: RiskCategory;
  department?: string;
  status?: RiskStatus;
  likelihood?: Likelihood;
  impact?: Impact;
  residualLikelihood?: Likelihood;
  residualImpact?: Impact;
  treatmentStrategy?: RiskTreatmentType;
  treatmentStrategyDescription?: string;
  assigneeId?: string | null;
}

interface UpdateRiskData {
  title?: string;
  description?: string;
  category?: RiskCategory;
  department?: string | null;
  status?: RiskStatus;
  likelihood?: Likelihood;
  impact?: Impact;
  residualLikelihood?: Likelihood;
  residualImpact?: Impact;
  treatmentStrategy?: RiskTreatmentType;
  treatmentStrategyDescription?: string | null;
  assigneeId?: string | null;
}

interface UseRisksOptions extends UseApiSWROptions<RisksResponse> {
  /** Initial data from server for hydration - avoids loading state on first render */
  initialData?: Risk[];
  /** Query parameters for filtering/pagination/sorting */
  queryParams?: RisksQueryParams;
}

interface UseRiskOptions extends UseApiSWROptions<RiskResponse> {
  /** Initial data from server for hydration - avoids loading state on first render */
  initialData?: RiskResponse;
}

/**
 * Hook to fetch all risks for the current organization using SWR
 * Provides automatic caching, revalidation, and real-time updates
 *
 * @example
 * // With server-side initial data (recommended for pages)
 * const { data, mutate } = useRisks({ initialData: serverRisks });
 *
 * @example
 * // Without initial data (shows loading state)
 * const { data, isLoading, mutate } = useRisks();
 */
export function useRisks(options: UseRisksOptions = {}) {
  const { initialData, queryParams, ...restOptions } = options;

  // Build URL with query params
  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (queryParams?.title) params.set('title', queryParams.title);
    if (queryParams?.page) params.set('page', String(queryParams.page));
    if (queryParams?.perPage) params.set('perPage', String(queryParams.perPage));
    if (queryParams?.sort) params.set('sort', queryParams.sort);
    if (queryParams?.sortDirection) params.set('sortDirection', queryParams.sortDirection);
    if (queryParams?.status) params.set('status', queryParams.status);
    if (queryParams?.category) params.set('category', queryParams.category);
    if (queryParams?.department) params.set('department', queryParams.department);
    if (queryParams?.assigneeId) params.set('assigneeId', queryParams.assigneeId);
    const qs = params.toString();
    return qs ? `/v1/risks?${qs}` : '/v1/risks';
  }, [queryParams]);

  return useApiSWR<RisksResponse>(endpoint, {
    ...restOptions,
    refreshInterval: restOptions.refreshInterval ?? 30000,
    ...(initialData && {
      fallbackData: {
        data: {
          data: initialData,
          totalCount: initialData.length,
          page: queryParams?.page ?? 1,
          pageCount: 1,
        },
        status: 200,
      } as ApiResponse<RisksResponse>,
    }),
  });
}

/**
 * Hook to fetch a single risk by ID using SWR
 * Provides real-time updates via polling
 *
 * @example
 * // With server-side initial data (recommended for detail pages)
 * const { data, mutate } = useRisk(riskId, { initialData: serverRisk });
 *
 * @example
 * // Without initial data (shows loading state)
 * const { data, isLoading, mutate } = useRisk(riskId);
 */
export function useRisk(riskId: string | null, options: UseRiskOptions = {}) {
  const result = riskHooks.useOne(riskId, options as never) as unknown as ReturnType<typeof riskHooks.useOne> & {
    risk?: RiskResponse | null;
    entity: RiskResponse | null;
    data: RiskResponse | null;
  };
  return { ...result, risk: (result as { entity: unknown }).entity ?? (result as { data: unknown }).data ?? null } as unknown as ReturnType<typeof riskHooks.useOne> & { risk: RiskResponse | null };
}

/**
 * Hook for risk CRUD operations (mutations)
 * Use alongside useRisks/useRisk and call mutate() after mutations
 */
export function useRiskActions() {
  const { create, update, remove } = riskHooks.useActions();

  const createRisk = create as (data: CreateRiskData) => Promise<Risk>;
  const updateRisk = update as (id: string, data: UpdateRiskData) => Promise<Risk>;
  const deleteRisk = remove as (id: string) => Promise<{ success: boolean; status: number }>;

  // Delegated linkage actions — previously 8 duplicated fetch blocks
  const regenerateMitigation = riskLinkage.regenerateMitigation;
  const autoLinkRisk = riskLinkage.autoLink;
  const relinkRisk = riskLinkage.relink;
  const suggestRiskLinks = riskLinkage.suggestLinks;
  const applyRiskLinks = riskLinkage.applyLinks;
  const fetchActiveRiskAutoLinkRun = riskLinkage.fetchActiveRun;
  const discardRiskAutoLinkRun = riskLinkage.discardRun;

  return {
    createRisk,
    updateRisk,
    deleteRisk,
    regenerateMitigation,
    autoLinkRisk,
    relinkRisk,
    suggestRiskLinks,
    applyRiskLinks,
    fetchActiveRiskAutoLinkRun,
    discardRiskAutoLinkRun,
  };
}
