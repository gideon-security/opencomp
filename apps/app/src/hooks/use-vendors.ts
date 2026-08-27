'use client';

import { useApiSWR, UseApiSWROptions } from '@/hooks/use-api-swr';
import { ApiResponse } from '@/lib/api-client';
import type {
  Impact,
  Likelihood,
  Prisma,
  RiskTreatmentType,
  TaskStatus,
  VendorCategory,
  VendorStatus,
} from '@db';
import { useApi } from '@/hooks/use-api';
import { createEntityHooks, createLinkageActions } from './create-entity-hooks';

export interface VendorLinkedTask {
  id: string;
  title: string;
  status: TaskStatus;
  controls: { id: string; name: string }[];
}

const vendorHooks = createEntityHooks<Vendor, VendorsResponse, CreateVendorData, UpdateVendorData>({
  basePath: '/v1/vendors',
});
const vendorLinkage = createLinkageActions('vendors');

export interface VendorAssignee {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

export interface Vendor {
  id: string;
  name: string;
  description: string;
  category: VendorCategory;
  status: VendorStatus;
  inherentProbability: Likelihood;
  inherentImpact: Impact;
  residualProbability: Likelihood;
  residualImpact: Impact;
  website: string | null;
  isSubProcessor: boolean;
  organizationId: string;
  assigneeId: string | null;
  assignee?: VendorAssignee | null;
  treatmentStrategy: RiskTreatmentType;
  treatmentStrategyDescription: string | null;
  tasks?: VendorLinkedTask[];
  createdAt: string;
  updatedAt: string;
}

interface VendorsResponse {
  data: Vendor[];
  count: number;
}

/**
 * Vendor response from API includes GlobalVendors risk assessment data
 */
export interface VendorResponse extends Vendor {
  // GlobalVendors risk assessment data merged by API
  riskAssessmentData?: Prisma.JsonValue | null;
  riskAssessmentVersion?: string | null;
  riskAssessmentUpdatedAt?: string | null;
}

interface CreateVendorData {
  name: string;
  description?: string;
  category?: VendorCategory;
  website?: string;
  assigneeId?: string;
}

interface UpdateVendorData {
  name?: string;
  description?: string;
  category?: VendorCategory;
  status?: VendorStatus;
  website?: string;
  isSubProcessor?: boolean;
  assigneeId?: string | null;
  inherentProbability?: Likelihood;
  inherentImpact?: Impact;
  residualProbability?: Likelihood;
  residualImpact?: Impact;
  treatmentStrategy?: RiskTreatmentType;
  treatmentStrategyDescription?: string | null;
}

interface UseVendorsOptions extends UseApiSWROptions<VendorsResponse> {
  /** Initial data from server for hydration - avoids loading state on first render */
  initialData?: Vendor[];
}

interface UseVendorOptions extends UseApiSWROptions<VendorResponse> {
  /** Initial data from server for hydration - avoids loading state on first render */
  initialData?: VendorResponse;
}

/**
 * Hook to fetch all vendors for the current organization using SWR
 * Provides automatic caching, revalidation, and real-time updates
 *
 * @example
 * // With server-side initial data (recommended for pages)
 * const { vendors, mutate } = useVendors({ initialData: serverVendors });
 *
 * @example
 * // Without initial data (shows loading state)
 * const { vendors, isLoading, mutate } = useVendors();
 */
export function useVendors(options: UseVendorsOptions = {}) {
  return vendorHooks.useList(options as never) as unknown as ReturnType<typeof vendorHooks.useList>;
}

/**
 * Hook to fetch a single vendor by ID using SWR
 * Provides real-time updates via polling
 *
 * @example
 * // With server-side initial data (recommended for detail pages)
 * const { data, mutate } = useVendor(vendorId, { initialData: serverVendor });
 *
 * @example
 * // Without initial data (shows loading state)
 * const { data, isLoading, mutate } = useVendor(vendorId);
 */
export function useVendor(vendorId: string | null, options: UseVendorOptions = {}) {
  const result = vendorHooks.useOne(vendorId, options as never) as unknown as ReturnType<typeof vendorHooks.useOne> & {
    vendor?: VendorResponse | null;
    entity: VendorResponse | null;
    data: VendorResponse | null;
  };
  // Keep backward-compat `vendor` alias alongside `entity`/`data`
  return { ...result, vendor: (result as { entity: unknown }).entity ?? (result as { data: unknown }).data ?? null } as unknown as ReturnType<typeof vendorHooks.useOne> & { vendor: VendorResponse | null };
}

/**
 * Hook for vendor CRUD operations (mutations)
 * Use alongside useVendors/useVendor and call mutate() after mutations
 */
interface TriggerAssessmentResponse {
  success: boolean;
  runId: string;
  publicAccessToken: string;
}

export function useVendorActions() {
  const { create, update, remove } = vendorHooks.useActions();
  const api = useApi();

  const createVendor = create as (data: CreateVendorData) => Promise<Vendor>;
  const updateVendor = update as (id: string, data: UpdateVendorData) => Promise<Vendor>;
  const deleteVendor = remove as (id: string) => Promise<{ success: boolean; status: number }>;

  const triggerAssessment = async (vendorId: string) => {
    const response = await api.post<TriggerAssessmentResponse>(
      `/v1/vendors/${vendorId}/trigger-assessment`,
      {},
    );
    if (response.error) throw new Error(response.error);
    return response.data!;
  };

  // Delegated linkage actions — previously 8 duplicated fetch blocks
  const regenerateMitigation = vendorLinkage.regenerateMitigation;
  const autoLinkVendor = vendorLinkage.autoLink;
  const relinkVendor = vendorLinkage.relink;
  const suggestVendorLinks = vendorLinkage.suggestLinks;
  const applyVendorLinks = vendorLinkage.applyLinks;
  const fetchActiveVendorAutoLinkRun = vendorLinkage.fetchActiveRun;
  const discardVendorAutoLinkRun = vendorLinkage.discardRun;

  return {
    createVendor,
    updateVendor,
    deleteVendor,
    triggerAssessment,
    regenerateMitigation,
    autoLinkVendor,
    relinkVendor,
    suggestVendorLinks,
    applyVendorLinks,
    fetchActiveVendorAutoLinkRun,
    discardVendorAutoLinkRun,
  };
}
