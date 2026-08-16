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
import { resetListingScroll, getListingScrollRoot, isListingScrollRestoreInProgress } from "@/lib/scroll-preservation";
import {
  subscribeListingNavigationLoadMore,
  writeListingNavigationContext,
} from "@/lib/listing-card-navigation-context";
import { SearchEmptyState } from "@/components/SearchEmptyState";
import { SearchMetrikaTracker } from "@/components/YandexMetrikaRouteTracker";
import { ListingFotoVPromtBanner } from "@/components/foto-v-promt-promo/ListingFotoVPromtBanner";
import { ListingGridLoadingSkeleton } from "@/components/ListingGridLoadingSkeleton";

// Match catalog batch size so both listings feel consistent.
const PAGE_SIZE = 48;

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
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(false);
  const offsetRef = useRef(0);
  const queryRef = useRef(query);

  queryRef.current = query;

  const doSearch = useCallback(async (q: string, append = false) => {
    if (q.length < 2) {
      if (!append) {
        setCardPages([]);
        setSearched(false);
        setHasMore(false);
        hasMoreRef.current = false;
      }
      return;
    }

    const newOffset = append ? offsetRef.current + PAGE_SIZE : 0;
    if (!append) {
      resetListingScroll();
    }
    setLoading(true);
    loadingRef.current = true;
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&limit=${PAGE_SIZE}&offset=${newOffset}`,
        { cache: "no-store" }
      );
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
    } catch {
      if (!append) setCardPages([]);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (initialQuery.length >= 2) {
      doSearch(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const q = searchParams.get("q")?.trim() || "";
    if (q !== query && q.length >= 2) {
      setQuery(q);
      setOffset(0);
      offsetRef.current = 0;
      doSearch(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const trimmed = query.trim();
    const timer = window.setTimeout(() => {
      const current = searchParams.get("q")?.trim() || "";
      if (trimmed.length >= 2 && trimmed !== current) {
        router.replace(`/search?q=${encodeURIComponent(trimmed)}`, { scroll: false });
      } else if (trimmed.length === 0 && current) {
        router.replace("/search", { scroll: false });
      }
    }, 320);
    return () => window.clearTimeout(timer);
  }, [query, router, searchParams]);

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
        writeListingNavigationContext(slugs);
      }
    }
  }, [displayedCards]);

  // Unified sentinel settings with catalog (600px lookahead).
  // On mobile the scroll container is #listing-scroll-root, not the viewport.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const scrollRoot = getListingScrollRoot();
    const observer = new IntersectionObserver(
      (entries) => {
        if (isListingScrollRestoreInProgress()) return;
        if (entries[0]?.isIntersecting && !loadingRef.current && hasMoreRef.current) {
          doSearch(queryRef.current, true);
        }
      },
      {
        root: scrollRoot instanceof HTMLElement ? scrollRoot : null,
        rootMargin: "600px",
      }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [doSearch]);

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

  return (
    <CardInteractionsProvider cardIds={cardIds}>
    <ListingExplorerFrame>
      <SearchMetrikaTracker query={query} />
      <ListingExplorerHeading
        eyebrow="Поиск"
        title={
          searched && query.trim().length >= 2
            ? `Результаты по запросу «${query.trim()}»`
            : "Поиск промтов"
        }
        titleAs="h1"
        intro={
          searched
            ? undefined
            : "Найдите готовый промт по стилю, сюжету или запросу."
        }
        countBadge={
          searched && displayedCards.length > 0 ? (
            <span className="inline-flex shrink-0 items-center rounded-full bg-zinc-100 px-3 py-1 text-sm tabular-nums text-zinc-600">
              {displayedCards.length}
              {hasMore ? "+" : ""}
              {matchType === "trgm" ? " · нечёткий" : ""}
            </span>
          ) : null
        }
      />

      <ListingExplorerSearch
        id="search-explorer-search"
        value={query}
        onChange={setQuery}
        onClear={() => setQuery("")}
        loading={loading}
      />

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

      <div className="relative mt-5 overflow-hidden">
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

      {searched && cards.length > 0 ? (
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
