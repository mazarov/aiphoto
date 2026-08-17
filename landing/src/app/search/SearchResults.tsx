"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ListingExplorerFrame } from "@/components/ListingExplorerFrame";
import {
  ListingExplorerHeading,
  ListingExplorerSearch,
} from "@/components/ListingExplorerSearch";
import { StableListingMasonry } from "@/components/StableListingMasonry";
import {
  appendUniqueCardPage,
  appendUniqueCardsById,
} from "@/lib/listing-cards";
import { LISTING_LCP_PRIORITY_GRID_ITEMS } from "@/lib/listing-lcp";
import type { PromptCardFull } from "@/lib/supabase";
import { CardInteractionsProvider } from "@/context/CardInteractionsContext";
import { FilterFAB } from "@/components/FilterFAB";
import { ListingDesktopFilters } from "@/components/ListingDesktopFilters";
import { useListingFilters } from "@/hooks/useListingFilters";
import type { FilterState } from "@/hooks/useListingFilters";
import { resetListingScroll } from "@/lib/scroll-preservation";
import { useListingSentinelLoadMore } from "@/hooks/useListingSentinelLoadMore";
import {
  primeListingNavigationCards,
  subscribeListingNavigationLoadMore,
  writeListingNavigationContext,
} from "@/lib/listing-card-navigation-context";
import { SearchEmptyState } from "@/components/SearchEmptyState";
import { SearchMetrikaTracker } from "@/components/YandexMetrikaRouteTracker";
import { ListingFotoVPromtBanner } from "@/components/foto-v-promt-promo/ListingFotoVPromtBanner";
import { ListingGridLoadingSkeleton } from "@/components/ListingGridLoadingSkeleton";

// Match catalog batch size so both listings feel consistent.
const PAGE_SIZE = 48;
const SEARCH_DEBOUNCE_MS = 500;

function cardMatchesFilters(card: PromptCardFull, f: FilterState): boolean {
  const tags = (card.seo_tags || {}) as Record<string, string[]>;
  if (f.audience && !(tags.audience_tag || []).includes(f.audience)) return false;
  if (f.style && !(tags.style_tag || []).includes(f.style)) return false;
  if (f.occasion && !(tags.occasion_tag || []).includes(f.occasion)) return false;
  if (f.object && !(tags.object_tag || []).includes(f.object)) return false;
  return true;
}

type Props = {
  initialQuery: string;
};

export function SearchResults({ initialQuery }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { filters, setFilter, applyFilters, resetFilters, activeCount } =
    useListingFilters({
      baseRpcParams: {},
      lockedDimensions: [],
    });
  const [query, setQuery] = useState(initialQuery);
  const [cardPages, setCardPages] = useState<PromptCardFull[][]>([]);
  const cards = useMemo(() => cardPages.flat(), [cardPages]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [matchType, setMatchType] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(false);
  const offsetRef = useRef(0);
  const queryRef = useRef(query);
  const lastSearchedRef = useRef<string | null>(null);
  const scheduleDrainRef = useRef(() => {});
  const activeSearchRef = useRef<AbortController | null>(null);

  queryRef.current = query;

  const doSearch = useCallback(async (q: string, append = false) => {
    if (q.length < 2) {
      if (!append) {
        activeSearchRef.current?.abort();
        activeSearchRef.current = null;
        setCardPages([]);
        setSearched(false);
        setLoading(false);
        loadingRef.current = false;
        setHasMore(false);
        hasMoreRef.current = false;
      }
      return;
    }

    const controller = new AbortController();
    activeSearchRef.current?.abort();
    activeSearchRef.current = controller;
    const newOffset = append ? offsetRef.current + PAGE_SIZE : 0;
    if (!append) {
      resetListingScroll();
    }
    setLoading(true);
    loadingRef.current = true;
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&limit=${PAGE_SIZE}&offset=${newOffset}`,
        { cache: "no-store", signal: controller.signal }
      );
      if (!res.ok) throw new Error("search_failed");
      const data = await res.json();
      const newCards = (data.cards || []) as PromptCardFull[];

      if (append) {
        setCardPages((prev) => appendUniqueCardPage(prev, newCards));
      } else {
        setCardPages([appendUniqueCardsById([], newCards)]);
      }
      setMatchType(data.matchType ?? null);
      setOffset(newOffset);
      offsetRef.current = newOffset;
      const more = newCards.length === PAGE_SIZE;
      setHasMore(more);
      hasMoreRef.current = more;
      setSearched(true);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      if (!append) setCardPages([]);
    } finally {
      if (activeSearchRef.current !== controller) return;
      activeSearchRef.current = null;
      setLoading(false);
      loadingRef.current = false;
      scheduleDrainRef.current();
    }
  }, []);

  useEffect(
    () => () => {
      activeSearchRef.current?.abort();
      activeSearchRef.current = null;
    },
    []
  );

  const { sentinelRef, scheduleDrain } = useListingSentinelLoadMore(
    () => {
      if (!loadingRef.current && hasMoreRef.current) {
        void doSearch(queryRef.current, true);
      }
    },
    () => loadingRef.current,
    () => hasMoreRef.current
  );
  scheduleDrainRef.current = scheduleDrain;

  const commitQueryToUrl = useCallback(
    (trimmed: string) => {
      const current = searchParams.get("q")?.trim() || "";
      if (trimmed.length >= 2 && trimmed !== current) {
        router.replace(`/search?q=${encodeURIComponent(trimmed)}`, { scroll: false });
      } else if (trimmed.length === 0 && current) {
        router.replace("/search", { scroll: false });
      }
    },
    [router, searchParams]
  );

  const runSearch = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      commitQueryToUrl(trimmed);
      if (trimmed === lastSearchedRef.current) return;
      lastSearchedRef.current = trimmed;
      setOffset(0);
      offsetRef.current = 0;
      void doSearch(trimmed);
    },
    [commitQueryToUrl, doSearch]
  );

  useEffect(() => {
    if (initialQuery.length >= 2) {
      lastSearchedRef.current = initialQuery;
      void doSearch(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const q = searchParams.get("q")?.trim() || "";
    if (q === lastSearchedRef.current) {
      if (q !== query) setQuery(q);
      return;
    }
    setQuery(q);
    lastSearchedRef.current = q;
    setOffset(0);
    offsetRef.current = 0;
    void doSearch(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      runSearch(query);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, runSearch]);

  const displayedPages = useMemo(
    () =>
      cardPages
        .map((page) =>
          activeCount === 0
            ? page
            : page.filter((card) => cardMatchesFilters(card, filters))
        )
        .filter((page) => page.length > 0),
    [activeCount, cardPages, filters]
  );
  const displayedCards = useMemo(
    () => displayedPages.flat(),
    [displayedPages]
  );

  useEffect(() => {
    if (displayedCards.length > 0) {
      const slugs = displayedCards.map((c) => c.slug).filter((s): s is string => !!s);
      if (slugs.length > 0) {
        primeListingNavigationCards(displayedCards);
        writeListingNavigationContext(slugs);
      }
    }
  }, [displayedCards]);

  useEffect(
    () =>
      subscribeListingNavigationLoadMore(() => {
        if (!loadingRef.current && hasMoreRef.current) {
          void doSearch(queryRef.current, true);
        }
      }),
    [doSearch]
  );

  const cardIds = useMemo(() => cards.map((c) => c.id), [cards]);

  const filtersEmpty =
    searched && !loading && cards.length > 0 && displayedCards.length === 0 && activeCount > 0;
  const searchEmpty =
    searched && !loading && cards.length === 0 && query.length >= 2;
  const showIdle = !searched && !loading && query.length < 2;

  const clearFilters = resetFilters;

  const showFilters = searched && cards.length > 0;

  return (
    <CardInteractionsProvider cardIds={cardIds}>
    <ListingExplorerFrame className={displayedCards.length > 0 ? undefined : "pb-5 sm:pb-7"}>
      <SearchMetrikaTracker query={query} />
      <ListingExplorerHeading
        eyebrow="Поиск"
        title="Поиск промтов"
        titleAs="h1"
        titleId="search-explorer-heading"
        intro={
          query.trim().length >= 2
            ? undefined
            : "Найдите готовый промт по стилю, сюжету или запросу."
        }
        countBadge={
          showFilters && displayedCards.length > 0 ? (
            <span className="inline-flex shrink-0 items-center rounded-full bg-zinc-100 px-3 py-1 text-sm tabular-nums text-zinc-600">
              {displayedCards.length}
              {hasMore ? "+" : ""}
              {matchType === "trgm" ? " · нечёткий" : ""}
              {matchType === "visual" ? " · по фото" : ""}
              {matchType === "fts+visual" || matchType === "trgm+visual"
                ? " · гибрид"
                : ""}
            </span>
          ) : null
        }
      />

      <ListingExplorerSearch
        id="search-explorer-search"
        value={query}
        onChange={setQuery}
        onClear={() => {
          setQuery("");
          runSearch("");
        }}
        onSubmit={() => runSearch(query)}
        loading={loading}
        autoFocus={initialQuery.length < 2}
      />

      {showFilters ? (
        <ListingDesktopFilters
          variant="explorer"
          filters={filters}
          onSetFilter={setFilter}
          onReset={resetFilters}
          activeCount={activeCount}
          hiddenDimensions={[]}
          cardsForCounts={cards}
          onOpenMobileFilters={() => setFilterPanelOpen(true)}
        />
      ) : null}

      <div className="relative mt-5">
        {displayedCards.length > 0 ? (
          <>
            <ListingFotoVPromtBanner />
            <StableListingMasonry
              cardPages={displayedPages}
              lcpPriorityCount={LISTING_LCP_PRIORITY_GRID_ITEMS}
              loading={loading}
            />
          </>
        ) : null}

        <div ref={sentinelRef} className="h-px" />
        {loading && <ListingGridLoadingSkeleton photoOnly />}

        {filtersEmpty ? (
          <SearchEmptyState variant="filters-empty" query={query} onClearFilters={clearFilters} />
        ) : null}
        {searchEmpty && !filtersEmpty ? (
          <SearchEmptyState variant="no-results" query={query} />
        ) : null}
        {showIdle ? (
          <p className="px-4 pb-8 pt-6 text-center text-sm text-zinc-500">
            Введите запрос — покажем подходящие промты.
          </p>
        ) : null}
      </div>

      {showFilters ? (
        <FilterFAB
          filters={filters}
          activeCount={activeCount}
          onApply={applyFilters}
          hiddenDimensions={[]}
          cardsForCounts={cards}
          open={filterPanelOpen}
          onOpenChange={setFilterPanelOpen}
        />
      ) : null}
    </ListingExplorerFrame>
    </CardInteractionsProvider>
  );
}
