"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { PromptCardFull } from "@/lib/supabase";
import { FilterableGrid } from "./CardFilters";
import { ListingGridLoadingSkeleton } from "./ListingGridLoadingSkeleton";
import { LISTING_INFINITE_PAGE_SIZE } from "@/lib/listing-pagination";

const PAGE_SIZE = LISTING_INFINITE_PAGE_SIZE;

type Props = {
  initialCards: PromptCardFull[];
  totalCount: number;
  /** Ranked rows in the first SSR batch (before sibling expansion). Must match resolve_route_cards LIMIT slice. */
  initialRankedBatchSize: number;
  rpcParams: Record<string, string | null>;
  strictMode?: boolean;
};

/** Offset/step в единицах ranked RPC (`cards_count` / `ranked_batch_size`), `totalCount` = `total_count`. */
function hasMorePages(rankedBatchSize: number, rankedOffset: number, totalCount: number) {
  if (rankedBatchSize <= 0) return false;
  return rankedOffset + rankedBatchSize < totalCount;
}

export function InfiniteGrid({
  initialCards,
  totalCount,
  initialRankedBatchSize,
  rpcParams,
  strictMode = false,
}: Props) {
  const [cards, setCards] = useState(initialCards);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(() =>
    hasMorePages(initialRankedBatchSize, 0, totalCount)
  );
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(hasMore);
  const offsetRef = useRef(initialRankedBatchSize);
  const rpcParamsRef = useRef(rpcParams);

  hasMoreRef.current = hasMore;
  rpcParamsRef.current = rpcParams;

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const oldOffset = offsetRef.current;
      const sp = new URLSearchParams();
      sp.set("limit", String(PAGE_SIZE));
      sp.set("offset", String(oldOffset));
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

      const step = rankedSize > 0 ? rankedSize : PAGE_SIZE;
      setCards((prev) => [...prev, ...newCards]);
      offsetRef.current = oldOffset + step;

      const more = oldOffset + step < totalCount;
      setHasMore(more);
      hasMoreRef.current = more;
    } catch {
      setHasMore(false);
      hasMoreRef.current = false;
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [strictMode, totalCount]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingRef.current && hasMoreRef.current) {
          loadMore();
        }
      },
      { rootMargin: "600px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // Sentinel is the same node as items append; reconnecting on every cards.length tick
    // caused extra layout/observer churn during scroll.
  }, [loadMore]);

  const countText = useMemo(() => {
    const n = totalCount;
    if (n === 1) return "1 промпт";
    if (n >= 2 && n <= 4) return `${n} промпта`;
    return `${n} промптов`;
  }, [totalCount]);

  return (
    <>
      <div className="mt-4 mb-8 flex items-center gap-3">
        <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-sm tabular-nums text-zinc-600">
          {countText}
        </span>
      </div>

      <FilterableGrid cards={cards} />

      <div ref={sentinelRef} className="h-px" />

      {loading && <ListingGridLoadingSkeleton />}
    </>
  );
}
