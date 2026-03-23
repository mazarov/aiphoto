"use client";

import { useMemo } from "react";
import { useListingFilters } from "@/hooks/useListingFilters";
import { FilterFAB } from "./FilterFAB";
import { InfiniteGrid } from "./InfiniteGrid";
import type { PromptCardFull } from "@/lib/supabase";
import type { Dimension } from "@/lib/tag-registry";

/** Stable React `key` — raw `JSON.stringify(mergedRpcParams)` can differ by object insertion order → remount grid on scroll/hydration churn. */
function stableRpcParamsKey(r: Record<string, string | null>): string {
  const sortedKeys = Object.keys(r).sort();
  const norm: Record<string, string | null> = {};
  for (const k of sortedKeys) {
    norm[k] = r[k] ?? null;
  }
  return JSON.stringify(norm);
}

type Props = {
  initialCards: PromptCardFull[];
  totalCount: number;
  /** Ranked rows returned by resolve_route_cards for the first page (before sibling expansion). */
  initialRankedBatchSize: number;
  baseRpcParams: Record<string, string | null>;
  lockedDimensions: Dimension[];
};

export function CatalogWithFilters({
  initialCards,
  totalCount,
  initialRankedBatchSize,
  baseRpcParams,
  lockedDimensions,
}: Props) {
  const { filters, applyFilters, activeCount, mergedRpcParams } = useListingFilters({
    baseRpcParams,
    lockedDimensions,
  });

  const listingGridKey = useMemo(
    () => stableRpcParamsKey(mergedRpcParams),
    [mergedRpcParams]
  );

  return (
    <>
      <InfiniteGrid
        key={listingGridKey}
        initialCards={initialCards}
        totalCount={totalCount}
        initialRankedBatchSize={initialRankedBatchSize}
        rpcParams={mergedRpcParams}
        strictMode={activeCount > 0}
      />
      <FilterFAB
        filters={filters}
        activeCount={activeCount}
        onApply={applyFilters}
        hiddenDimensions={lockedDimensions}
        rpcParams={mergedRpcParams}
      />
    </>
  );
}
