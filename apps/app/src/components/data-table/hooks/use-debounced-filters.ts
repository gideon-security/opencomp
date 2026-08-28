'use client';

import { useDebouncedCallback } from '@gideon-defender/ui/hooks/use-debounced-callback';
import { useQueryState } from 'nuqs';
import { getFiltersStateParser } from '@/lib/parsers';
import type { ExtendedColumnFilter } from '@/types/data-table';

export const FILTERS_KEY = 'filters';
export const DEBOUNCE_MS = 300;
export const THROTTLE_MS = 50;

/**
 * Shared debounced filter state for data-table filter menus/lists.
 * Deduplicates `useQueryState(FILTERS_KEY, getFiltersStateParser(...))`
 * + `useDebouncedCallback(setFilters, debounceMs)` that was duplicated
 * between `data-table-filter-menu.tsx` and `data-table-filter-list.tsx`.
 */
export function useDebouncedFilters<TData>(params: {
  columnIds: string[];
  debounceMs?: number;
  throttleMs?: number;
  shallow?: boolean;
}) {
  const { columnIds, debounceMs = DEBOUNCE_MS, throttleMs = THROTTLE_MS, shallow = true } = params;

  const [filters, setFilters] = useQueryState(
    FILTERS_KEY,
    getFiltersStateParser<TData>(columnIds)
      .withDefault([])
      .withOptions({
        clearOnDefault: true,
        shallow,
        throttleMs,
      }),
  );

  const debouncedSetFilters = useDebouncedCallback(setFilters, debounceMs);

  return { filters, setFilters, debouncedSetFilters } as const;
}
