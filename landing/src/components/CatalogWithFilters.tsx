"use client";

import { useMemo, useLayoutEffect } from "react";
import { useListingFilters } from "@/hooks/useListingFilters";
import { FilterFAB } from "./FilterFAB";
import { InfiniteGrid } from "./InfiniteGrid";
import type { PromptCardFull } from "@/lib/supabase";
import type { Dimension } from "@/lib/tag-registry";

const SCROLL_RESTORE_KEY = "card_modal_scroll_pos";

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

  // Restore scroll position when returning from card modal
  useLayoutEffect(() => {
    const savedScrollY = sessionStorage.getItem(SCROLL_RESTORE_KEY);
    if (savedScrollY) {
      const scrollY = parseInt(savedScrollY, 10);
      // Synchronous restore before paint to avoid flicker
      window.scrollTo(0, scrollY);
      // Also set scrollRestoration to manual temporarily
      const originalRestoration = window.history.scrollRestoration;
      window.history.scrollRestoration = "manual";
      sessionStorage.removeItem(SCROLL_RESTORE_KEY);
      // Restore auto behavior after a short delay
      setTimeout(() => {
        window.history.scrollRestoration = originalRestoration;
      }, 100);
    }
  }, []);

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
