"use client";

import { useListingFilters } from "@/hooks/useListingFilters";
import { FilterFAB } from "./FilterFAB";
import { InfiniteGrid } from "./InfiniteGrid";
import type { PromptCardFull } from "@/lib/supabase";
import type { Dimension } from "@/lib/tag-registry";

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

  return (
    <>
      <InfiniteGrid
        key={JSON.stringify(mergedRpcParams)}
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
