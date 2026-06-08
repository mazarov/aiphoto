"use client";

import { useCallback, useEffect, useState } from "react";
import { useListingMobileChromeOptional } from "@/context/ListingMobileChromeContext";
import { FilterPanel } from "./FilterPanel";
import type { FilterState } from "@/hooks/useListingFilters";
import type { Dimension } from "@/lib/tag-registry";
import type { PromptCardFull } from "@/lib/supabase";
import type { ListingSort } from "@/lib/listing-sort";

type Props = {
  filters: FilterState;
  activeCount: number;
  onApply: (nextFilters: FilterState) => void;
  hiddenDimensions: Dimension[];
  /** Catalog: fetch counts from API */
  rpcParams?: Record<string, string | null>;
  /** Search: compute counts from loaded cards */
  cardsForCounts?: PromptCardFull[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  sort?: ListingSort;
  onSortChange?: (sort: ListingSort) => void;
};

function useIsMobileFilterViewport() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return isMobile;
}

export function FilterFAB({
  filters,
  activeCount,
  onApply,
  hiddenDimensions,
  rpcParams,
  cardsForCounts,
  open: openProp,
  onOpenChange,
  sort,
  onSortChange,
}: Props) {
  const registerFilter = useListingMobileChromeOptional()?.registerFilter;
  const isMobile = useIsMobileFilterViewport();
  const [internalOpen, setInternalOpen] = useState(false);

  const panelOpen = openProp ?? internalOpen;
  const setPanelOpen = useCallback(
    (next: boolean) => {
      onOpenChange?.(next);
      if (openProp === undefined) setInternalOpen(next);
    },
    [onOpenChange, openProp]
  );

  useEffect(() => {
    if (!registerFilter || !isMobile) {
      registerFilter?.(null);
      return;
    }
    registerFilter({
      activeCount,
      open: () => setPanelOpen(true),
    });
    return () => registerFilter(null);
  }, [registerFilter, activeCount, isMobile, setPanelOpen]);

  if (!isMobile || !panelOpen) return null;

  return (
    <FilterPanel
      filters={filters}
      onApply={onApply}
      onClose={() => setPanelOpen(false)}
      hiddenDimensions={hiddenDimensions}
      rpcParams={rpcParams}
      cardsForCounts={cardsForCounts}
      sort={sort}
      onSortChange={onSortChange}
    />
  );
}
