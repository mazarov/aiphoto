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
  const [loadError, setLoadError] = useState(false);
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
    setLoadError(false);
    let shouldDrain = false;
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
      if (!res.ok) {
        throw new Error(`listing_request_failed:${res.status}`);
      }
      const data = await res.json();
      const newCards = (data.cards || []) as PromptCardFull[];
      const rankedSize = Math.max(0, Number(data.ranked_batch_size) || 0);

      const apiTotal = Number(data.total_count);
      if (Number.isFinite(apiTotal) && apiTotal >= 0) {
        totalCountRef.current = apiTotal;
      }
      if (rankedSize === 0) {
        setHasMore(false);
        hasMoreRef.current = false;
        return;
      }

      const step = resolveListingPageStep(rankedSize);
      if (newCards.length > 0) {
        setCardPages((prev) => appendUniqueCardPage(prev, newCards));
      }
      offsetRef.current = oldOffset + step;

      const more = hasMoreRankedPages(oldOffset, step, totalCountRef.current);
      setHasMore(more);
      hasMoreRef.current = more;
      shouldDrain = more;
    } catch (error) {
      console.error("[InfiniteGrid] load more failed", error);
      // A transient request failure is not the end of the listing.
      // Keep hasMore=true so the next scroll or explicit retry can recover.
      setLoadError(true);
    } finally {
      setLoading(false);
      loadingRef.current = false;
      if (shouldDrain) scheduleDrainRef.current();
    }
  }, [strictMode]);

  const { sentinelRef, scheduleDrain } = useListingSentinelLoadMore(
    loadMore,
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
      {loadError && (
        <div
          className="flex flex-col items-center gap-3 py-6 text-center"
          role="status"
        >
          <p className="text-sm text-zinc-600">
            Не удалось загрузить следующие карточки.
          </p>
          <button
            type="button"
            onClick={() => void loadMore()}
            className="min-h-11 rounded-full border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50"
          >
            Повторить
          </button>
        </div>
      )}
    </>
  );
}
