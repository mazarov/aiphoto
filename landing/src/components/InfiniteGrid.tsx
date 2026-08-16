"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { PromptCardFull } from "@/lib/supabase";
import type { ListingSort } from "@/lib/listing-sort";
import { FilterableGrid } from "./CardFilters";
import { ListingGridLoadingSkeleton } from "./ListingGridLoadingSkeleton";
import {
  appendUniqueCardPage,
  appendUniqueCardsById,
} from "@/lib/listing-cards";
import { useListingSentinelLoadMore } from "@/hooks/useListingSentinelLoadMore";
import {
  LISTING_INFINITE_PAGE_SIZE,
  hasMoreRankedPages,
  resolveListingPageStep,
} from "@/lib/listing-pagination";
import { subscribeListingNavigationLoadMore } from "@/lib/listing-card-navigation-context";

const PAGE_SIZE = LISTING_INFINITE_PAGE_SIZE;

type Props = {
  initialCards: PromptCardFull[];
  totalCount: number;
  /** Ranked rows in the first SSR batch (before sibling expansion). Must match resolve_route_cards LIMIT slice. */
  initialRankedBatchSize: number;
  rpcParams: Record<string, string | null>;
  strictMode?: boolean;
  sort?: ListingSort;
};

export function InfiniteGrid({
  initialCards,
  totalCount,
  initialRankedBatchSize,
  rpcParams,
  strictMode = false,
  sort = "new",
}: Props) {
  const [cardPages, setCardPages] = useState<PromptCardFull[][]>(() => [
    appendUniqueCardsById([], initialCards),
  ]);
  const cards = useMemo(() => cardPages.flat(), [cardPages]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(() =>
    hasMoreRankedPages(0, initialRankedBatchSize, totalCount)
  );
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(hasMore);
  const offsetRef = useRef(initialRankedBatchSize);
  const rpcParamsRef = useRef(rpcParams);
  const sortRef = useRef(sort);
  const totalCountRef = useRef(totalCount);

  hasMoreRef.current = hasMore;
  rpcParamsRef.current = rpcParams;
  sortRef.current = sort;
  totalCountRef.current = totalCount;

  const scheduleDrainRef = useRef(() => {});

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const oldOffset = offsetRef.current;
      const sp = new URLSearchParams();
      sp.set("limit", String(PAGE_SIZE));
      sp.set("offset", String(oldOffset));
      // Default sort is `new` (omit param); only non-default `popular` is sent.
      if (sortRef.current === "popular") sp.set("sort", "popular");
      for (const [k, v] of Object.entries(rpcParamsRef.current)) {
        if (v) sp.set(k, v);
      }
      if (strictMode) sp.set("strict", "1");
      const res = await fetch(`/api/listing?${sp}`);
      const data = await res.json();
      const newCards = (data.cards || []) as PromptCardFull[];
      const rankedSize = Math.max(0, Number(data.ranked_batch_size) || 0);

      if (newCards.length === 0) {
        setHasMore(false);
        hasMoreRef.current = false;
        return;
      }

      const step = resolveListingPageStep(rankedSize);
      setCardPages((prev) => appendUniqueCardPage(prev, newCards));
      offsetRef.current = oldOffset + step;

      const apiTotal = Number(data.total_count);
      if (Number.isFinite(apiTotal) && apiTotal > 0) {
        totalCountRef.current = apiTotal;
      }
      const more = hasMoreRankedPages(oldOffset, step, totalCountRef.current);
      setHasMore(more);
      hasMoreRef.current = more;
    } catch {
      setHasMore(false);
      hasMoreRef.current = false;
    } finally {
      setLoading(false);
      loadingRef.current = false;
      scheduleDrainRef.current();
    }
  }, [strictMode]);

  const { sentinelRef, scheduleDrain } = useListingSentinelLoadMore(
    () => {
      void loadMore();
    },
    () => loadingRef.current,
    () => hasMoreRef.current
  );
  scheduleDrainRef.current = scheduleDrain;

  useEffect(
    () =>
      subscribeListingNavigationLoadMore(() => {
        void loadMore();
      }),
    [loadMore]
  );

  return (
    <>
      <div className="mb-8">
        <FilterableGrid cards={cards} cardPages={cardPages} sort={sort} />
      </div>

      <div ref={sentinelRef} className="h-px" />

      {loading && <ListingGridLoadingSkeleton photoOnly />}
    </>
  );
}
