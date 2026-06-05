"use client";

import { useEffect, useState } from "react";
import { useListingMobileChromeOptional } from "@/context/ListingMobileChromeContext";
import { FilterPanel } from "./FilterPanel";
import type { FilterState } from "@/hooks/useListingFilters";
import type { Dimension } from "@/lib/tag-registry";
import type { PromptCardFull } from "@/lib/supabase";

type Props = {
  filters: FilterState;
  activeCount: number;
  onApply: (nextFilters: FilterState) => void;
  hiddenDimensions: Dimension[];
  /** Catalog: fetch counts from API */
  rpcParams?: Record<string, string | null>;
  /** Search: compute counts from loaded cards */
  cardsForCounts?: PromptCardFull[];
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
}: Props) {
  const registerFilter = useListingMobileChromeOptional()?.registerFilter;
  const isMobile = useIsMobileFilterViewport();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!registerFilter || !isMobile) {
      registerFilter?.(null);
      return;
    }
    registerFilter({
      activeCount,
      open: () => setOpen(true),
    });
    return () => registerFilter(null);
  }, [registerFilter, activeCount, isMobile]);

  if (!isMobile || !open) return null;

  return (
    <FilterPanel
      filters={filters}
      onApply={onApply}
      onClose={() => setOpen(false)}
      hiddenDimensions={hiddenDimensions}
      rpcParams={rpcParams}
      cardsForCounts={cardsForCounts}
    />
  );
}
