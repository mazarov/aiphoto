"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { Dimension } from "@/lib/tag-registry";

export type FilterState = {
  audience: string | null;
  style: string | null;
  occasion: string | null;
  object: string | null;
};

const QUERY_KEYS: Record<keyof FilterState, string> = {
  audience: "audience",
  style: "style",
  occasion: "occasion",
  object: "object",
};

/** RPC param names for API */
export const FILTER_TO_RPC: Record<keyof FilterState, string> = {
  audience: "audience_tag",
  style: "style_tag",
  occasion: "occasion_tag",
  object: "object_tag",
};

export type UseListingFiltersOptions = {
  /** Dimensions already set by URL path (e.g. style_tag for /stil/portret/) — hide from panel */
  lockedDimensions?: Dimension[];
  /** Base RPC params from route (merged with filters) */
  baseRpcParams?: Record<string, string | null>;
};

export function useListingFilters(options: UseListingFiltersOptions = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lockedDimensions = [], baseRpcParams = {} } = options;

  const filters = useMemo<FilterState>(() => {
    const f: FilterState = {
      audience: searchParams.get(QUERY_KEYS.audience) || null,
      style: searchParams.get(QUERY_KEYS.style) || null,
      occasion: searchParams.get(QUERY_KEYS.occasion) || null,
      object: searchParams.get(QUERY_KEYS.object) || null,
    };
    return f;
  }, [searchParams]);

  const activeCount = useMemo(() => {
    return [filters.audience, filters.style, filters.occasion, filters.object].filter(Boolean).length;
  }, [filters]);

  const mergedRpcParams = useMemo(() => {
    const out = { ...baseRpcParams };
    if (filters.audience) out.audience_tag = filters.audience;
    if (filters.style) out.style_tag = filters.style;
    if (filters.occasion) out.occasion_tag = filters.occasion;
    if (filters.object) out.object_tag = filters.object;
    return out;
  }, [baseRpcParams, filters]);

  const applyFilters = useCallback(
    (nextFilters: FilterState) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const k of Object.keys(QUERY_KEYS) as (keyof FilterState)[]) {
        const v = nextFilters[k];
        if (v) sp.set(QUERY_KEYS[k], v);
        else sp.delete(QUERY_KEYS[k]);
      }
      const qs = sp.toString();
      const path = typeof window !== "undefined" ? window.location.pathname : "";
      router.push(qs ? `${path}?${qs}` : path, { scroll: false });
    },
    [router, searchParams]
  );

  const setFilter = useCallback(
    (key: keyof FilterState, value: string | null) => {
      const next = { ...filters, [key]: value };
      applyFilters(next);
    },
    [filters, applyFilters]
  );

  const resetFilters = useCallback(() => {
    applyFilters({
      audience: null,
      style: null,
      occasion: null,
      object: null,
    });
  }, [applyFilters]);

  const isDimensionLocked = useCallback(
    (dim: Dimension): boolean => {
      const map: Record<Dimension, keyof FilterState> = {
        audience_tag: "audience",
        style_tag: "style",
        occasion_tag: "occasion",
        object_tag: "object",
        doc_task_tag: "object",
      };
      const key = map[dim];
      return key ? lockedDimensions.includes(dim) : false;
    },
    [lockedDimensions]
  );

  return {
    filters,
    setFilter,
    applyFilters,
    resetFilters,
    activeCount,
    mergedRpcParams,
    isDimensionLocked,
  };
}
