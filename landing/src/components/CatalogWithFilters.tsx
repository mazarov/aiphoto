"use client";

import { useMemo, useState } from "react";
import { useListingFilters } from "@/hooks/useListingFilters";
import { useListingSort } from "@/hooks/useListingSort";
import { FilterFAB } from "./FilterFAB";
import { ListingDesktopFilters } from "./ListingDesktopFilters";
import { InfiniteGrid } from "./InfiniteGrid";
import type { PromptCardFull } from "@/lib/supabase";
import type { Dimension } from "@/lib/tag-registry";
import type { ListingSort } from "@/lib/listing-sort";

/** Stable React `key` — raw `JSON.stringify(mergedRpcParams)` can differ by object insertion order → remount grid on scroll/hydration churn. */
function stableListingKey(r: Record<string, string | null>, sort: ListingSort): string {
  const sortedKeys = Object.keys(r).sort();
  const norm: Record<string, string | null> = {};
  for (const k of sortedKeys) {
    norm[k] = r[k] ?? null;
  }
  return `${JSON.stringify(norm)}|${sort}`;
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
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const { filters, setFilter, applyFilters, resetFilters, activeCount, mergedRpcParams } =
    useListingFilters({
      baseRpcParams,
      lockedDimensions,
    });
  const { sort, setSort } = useListingSort();

  const listingGridKey = useMemo(
    () => stableListingKey(mergedRpcParams, sort),
    [mergedRpcParams, sort]
  );

  const showNewEmpty = sort === "new" && totalCount === 0;

  return (
    <>
      <ListingDesktopFilters
        filters={filters}
        onSetFilter={setFilter}
        onReset={resetFilters}
        activeCount={activeCount}
        hiddenDimensions={lockedDimensions}
        rpcParams={mergedRpcParams}
        sort={sort}
        onSortChange={setSort}
        onOpenMobileFilters={() => setFilterPanelOpen(true)}
      />

      {showNewEmpty ? (
        <p className="py-16 text-center text-sm text-zinc-500">Пока нет новых</p>
      ) : (
        <InfiniteGrid
          key={listingGridKey}
          initialCards={initialCards}
          totalCount={totalCount}
          initialRankedBatchSize={initialRankedBatchSize}
          rpcParams={mergedRpcParams}
          strictMode={activeCount > 0}
          sort={sort}
        />
      )}

      <FilterFAB
        filters={filters}
        activeCount={activeCount}
        onApply={applyFilters}
        hiddenDimensions={lockedDimensions}
        rpcParams={mergedRpcParams}
        open={filterPanelOpen}
        onOpenChange={setFilterPanelOpen}
        sort={sort}
        onSortChange={setSort}
      />
    </>
  );
}
