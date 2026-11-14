"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { PromptCardFull } from "@/lib/supabase";
import { LISTING_DEFAULT_SORT, type ListingSort } from "@/lib/listing-sort";
import { FilterableGrid } from "./CardFilters";
import { ListingGridLoadingSkeleton } from "./ListingGridLoadingSkeleton";
import {
  appendUniqueCardPage,
  appendUniqueCardsById,
} from "@/lib/listing-cards";
import { useListingSentinelLoadMore } from "@/hooks/useListingSentinelLoadMore";
import {
  LISTING_INFINITE_PAGE_SIZE,
  LISTING_LOAD_MORE_LABEL,
  LISTING_SEARCH_PAGE_SIZE,
  hasMoreRankedPages,
  hasMoreSearchPages,
  resolveListingPageStep,
} from "@/lib/listing-pagination";
import { omitCardFromPages } from "@/lib/debug-hide-card";
import { useDebugCardHidden } from "@/hooks/useDebugCardHidden";

const PAGE_SIZE = LISTING_INFINITE_PAGE_SIZE;

/** Same pill as the listing generate FAB. */
const TEASER_LOAD_MORE_BUTTON =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-indigo-600 px-5 text-[13px] font-semibold text-white shadow-[0_12px_32px_-10px_rgba(79,70,229,0.55)] transition hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";

/** How far the last full row dissolves into the panel. The button sits in this band. */
const TEASER_ROW_FADE_PX = 88;

function TeaserLoadMoreChevron() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type Props = {
  initialCards: PromptCardFull[];
  totalCount: number;
  /** Ranked rows in the first SSR batch (before sibling expansion). Must match resolve_route_cards LIMIT slice. */
  initialRankedBatchSize: number;
  rpcParams: Record<string, string | null>;
  strictMode?: boolean;
  sort?: ListingSort;
  /** When set, pages come from hybrid listing search via `/api/listing?q=`, not tag RPC. */
  searchQuery?: string | null;
  searchFilters?: Record<string, string | null | undefined>;
  searchHasMore?: boolean;
  /** Catalog hubs: «Ещё» floats on the photos, including after the first page. */
  teaserLoadMore?: boolean;
  headingAltSlots?: readonly string[];
};

export function InfiniteGrid({
  initialCards,
  totalCount,
  initialRankedBatchSize,
  rpcParams,
  strictMode = false,
  sort = LISTING_DEFAULT_SORT,
  searchQuery = null,
  searchFilters = {},
  searchHasMore = false,
  teaserLoadMore = false,
  headingAltSlots,
}: Props) {
  const [cardPages, setCardPages] = useState<PromptCardFull[][]>(() => [
    appendUniqueCardsById([], initialCards),
  ]);
  const cards = useMemo(() => cardPages.flat(), [cardPages]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [hasMore, setHasMore] = useState(() =>
    searchQuery
      ? searchHasMore
      : hasMoreRankedPages(0, initialRankedBatchSize, totalCount)
  );
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(hasMore);
  const offsetRef = useRef(initialRankedBatchSize);
  const rpcParamsRef = useRef(rpcParams);
  const sortRef = useRef(sort);
  const totalCountRef = useRef(totalCount);
  const searchQueryRef = useRef(searchQuery);
  const searchFiltersRef = useRef(searchFilters);
  const teaserBlocksAutoLoadRef = useRef(false);

  hasMoreRef.current = hasMore;
  teaserBlocksAutoLoadRef.current = teaserLoadMore;
  rpcParamsRef.current = rpcParams;
  sortRef.current = sort;
  totalCountRef.current = totalCount;
  searchQueryRef.current = searchQuery;
  searchFiltersRef.current = searchFilters;

  const scheduleDrainRef = useRef(() => {});

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setLoadError(false);
    try {
      const oldOffset = offsetRef.current;
      const listingQuery = searchQueryRef.current?.trim();
      const pageSize = listingQuery ? LISTING_SEARCH_PAGE_SIZE : PAGE_SIZE;
      const sp = new URLSearchParams();
      sp.set("limit", String(pageSize));
      sp.set("offset", String(oldOffset));
      if (listingQuery) {
        sp.set("q", listingQuery);
        for (const [key, value] of Object.entries(searchFiltersRef.current)) {
          if (value) sp.set(key, value);
        }
      } else {
        sp.set("sort", sortRef.current);
        for (const [k, v] of Object.entries(rpcParamsRef.current)) {
          if (v) sp.set(k, v);
        }
        if (strictMode) sp.set("strict", "1");
      }
      const res = await fetch(
        `/api/listing?${sp}`,
        listingQuery ? { cache: "default" } : { cache: "no-store" },
      );
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
      if (rankedSize === 0 && newCards.length === 0) {
        setHasMore(false);
        hasMoreRef.current = false;
        return;
      }

      const step = listingQuery
        ? rankedSize || newCards.length
        : resolveListingPageStep(rankedSize);
      if (newCards.length > 0) {
        setCardPages((prev) => appendUniqueCardPage(prev, newCards));
      }
      offsetRef.current = oldOffset + step;

      const more =
        listingQuery && typeof data.has_more === "boolean"
          ? data.has_more
          : listingQuery
            ? hasMoreSearchPages(rankedSize || newCards.length, pageSize)
            : hasMoreRankedPages(oldOffset, step, totalCountRef.current);
      setHasMore(more);
      hasMoreRef.current = more;
    } catch (error) {
      console.error("[InfiniteGrid] load more failed", error);
      // A transient request failure is not the end of the listing.
      // Keep hasMore=true so the next scroll or explicit retry can recover.
      setLoadError(true);
    } finally {
      setLoading(false);
      loadingRef.current = false;
      scheduleDrainRef.current();
    }
  }, [strictMode, teaserLoadMore]);

  const { sentinelRef, scheduleDrain } = useListingSentinelLoadMore(
    loadMore,
    () => loadingRef.current,
    () => hasMoreRef.current && !teaserBlocksAutoLoadRef.current
  );
  scheduleDrainRef.current = scheduleDrain;

  useDebugCardHidden(
    useCallback((detail) => {
      setCardPages((pages) => omitCardFromPages(pages, detail.cardId));
    }, []),
  );

  const showFloatingMore =
    teaserLoadMore && hasMore && cards.length > 0;

  return (
    <>
      <div className={`mb-8${showFloatingMore ? " relative" : ""}`}>
        <FilterableGrid
          cards={cards}
          cardPages={cardPages}
          sort={sort}
          headingAltSlots={headingAltSlots}
          clipToShortestColumn={showFloatingMore}
          hasMore={hasMore}
          onLoadMore={loadMore}
        />
        {showFloatingMore ? (
          <>
            <div
              className="absolute inset-x-0 bottom-0 z-20"
              style={{ height: TEASER_ROW_FADE_PX }}
              aria-hidden
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center">
              <button
                type="button"
                disabled={loading}
                onClick={() => void loadMore()}
                className={`pointer-events-auto ${TEASER_LOAD_MORE_BUTTON}`}
              >
                {loading ? "Загружаем…" : LISTING_LOAD_MORE_LABEL}
                <TeaserLoadMoreChevron />
              </button>
            </div>
          </>
        ) : null}
      </div>

      {teaserLoadMore ? null : <div ref={sentinelRef} className="h-px" />}

      {hasMore && !loading && searchQuery ? (
        <div className="flex flex-col items-center gap-3 py-4">
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadMore()}
            className="min-h-11 rounded-full border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50"
          >
            {loading ? "Загружаем…" : LISTING_LOAD_MORE_LABEL}
          </button>
        </div>
      ) : null}

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
