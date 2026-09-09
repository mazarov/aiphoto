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
  LISTING_SEARCH_PAGE_SIZE,
  hasMoreRankedPages,
  hasMoreSearchPages,
  resolveListingPageStep,
} from "@/lib/listing-pagination";
import { subscribeListingNavigationLoadMore } from "@/lib/listing-card-navigation-context";

const PAGE_SIZE = LISTING_INFINITE_PAGE_SIZE;

const TEASER_LOAD_MORE_BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-indigo-200 bg-white/95 px-5 text-sm font-semibold text-indigo-700 shadow-sm backdrop-blur-sm transition hover:border-indigo-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60";

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
  /** First screen like `/generaciya-foto`: fade + button, then explicit «Показать ещё». */
  teaserLoadMore?: boolean;
  teaserLoadMoreLabel?: string;
  headingAltSlots?: readonly string[];
};

export function InfiniteGrid({
  initialCards,
  totalCount,
  initialRankedBatchSize,
  rpcParams,
  strictMode = false,
  sort = "new",
  searchQuery = null,
  searchFilters = {},
  searchHasMore = false,
  teaserLoadMore = false,
  teaserLoadMoreLabel = "Показать ещё",
  headingAltSlots,
}: Props) {
  const [cardPages, setCardPages] = useState<PromptCardFull[][]>(() => [
    appendUniqueCardsById([], initialCards),
  ]);
  const cards = useMemo(() => cardPages.flat(), [cardPages]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [galleryRevealed, setGalleryRevealed] = useState(false);
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
      // Default sort is `new` (omit param); only non-default `popular` is sent.
      if (listingQuery) {
        sp.set("q", listingQuery);
        for (const [key, value] of Object.entries(searchFiltersRef.current)) {
          if (value) sp.set(key, value);
        }
      } else {
        if (sortRef.current === "popular") sp.set("sort", "popular");
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
        if (teaserLoadMore) setGalleryRevealed(true);
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

  useEffect(
    () =>
      subscribeListingNavigationLoadMore(() => {
        void loadMore();
      }),
    [loadMore]
  );

  const showTeaserOverlay =
    teaserLoadMore && hasMore && !galleryRevealed && cards.length > 0;
  const showTeaserMoreButton =
    teaserLoadMore && hasMore && galleryRevealed;

  return (
    <>
      <div
        className={`mb-8${showTeaserOverlay ? " relative overflow-hidden" : ""}`}
      >
        <FilterableGrid
          cards={cards}
          cardPages={cardPages}
          sort={sort}
          headingAltSlots={headingAltSlots}
        />
        {showTeaserOverlay ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30">
            <div
              className="absolute inset-x-0 bottom-0 h-32 backdrop-blur-[6px] [mask-image:linear-gradient(to_top,black,transparent)] sm:h-40"
              aria-hidden
            />
            <div
              className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white/50 via-white/15 to-transparent sm:h-40"
              aria-hidden
            />
            <div className="relative flex justify-center pb-24 pt-16 sm:pb-28 sm:pt-20">
              <button
                type="button"
                disabled={loading}
                onClick={() => void loadMore()}
                className={`pointer-events-auto ${TEASER_LOAD_MORE_BUTTON}`}
              >
                {loading ? "Загружаем…" : teaserLoadMoreLabel}
                <TeaserLoadMoreChevron />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {teaserLoadMore ? null : <div ref={sentinelRef} className="h-px" />}

      {showTeaserMoreButton || (hasMore && !loading && searchQuery) ? (
        <div className="flex flex-col items-center gap-3 py-4">
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadMore()}
            className={
              showTeaserMoreButton
                ? TEASER_LOAD_MORE_BUTTON
                : "min-h-11 rounded-full border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50"
            }
          >
            {loading ? "Загружаем…" : "Показать ещё"}
            {showTeaserMoreButton ? <TeaserLoadMoreChevron /> : null}
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
