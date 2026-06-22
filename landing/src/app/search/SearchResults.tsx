"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { PromptCard } from "@/components/PromptCard";
import { LISTING_LCP_PRIORITY_GRID_ITEMS } from "@/lib/listing-lcp";
import type { PromptCardFull } from "@/lib/supabase";
import { CardInteractionsProvider } from "@/context/CardInteractionsContext";
import { FilterFAB } from "@/components/FilterFAB";
import { ListingDesktopFilters } from "@/components/ListingDesktopFilters";
import { useListingFilters } from "@/hooks/useListingFilters";
import type { FilterState } from "@/hooks/useListingFilters";
import { resetListingScroll, getListingScrollRoot, isListingScrollRestoreInProgress } from "@/lib/scroll-preservation";
import { writeListingNavigationContext } from "@/lib/listing-card-navigation-context";
import { SearchEmptyState } from "@/components/SearchEmptyState";
import { SearchMetrikaTracker } from "@/components/YandexMetrikaRouteTracker";
import { ListingFotoVPromtBanner } from "@/components/foto-v-promt-promo/ListingFotoVPromtBanner";
import { ListingGrid } from "@/components/ListingGrid";
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
  const searchParams = useSearchParams();
  const { filters, setFilter, applyFilters, resetFilters, activeCount } =
    useListingFilters({
      baseRpcParams: {},
      lockedDimensions: [],
    });
  const [query, setQuery] = useState(initialQuery);
  const [cards, setCards] = useState<PromptCardFull[]>([]);
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
        setCards([]);
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
        setCards((prev) => [...prev, ...newCards]);
      } else {
        setCards(newCards);
      }
      setMatchType(data.matchType ?? null);
      setOffset(newOffset);
      offsetRef.current = newOffset;
      const more = newCards.length === PAGE_SIZE;
      setHasMore(more);
      hasMoreRef.current = more;
      setSearched(true);
    } catch {
      if (!append) setCards([]);
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

  const displayedCards = useMemo(() => {
    if (activeCount === 0) return cards;
    return cards.filter((c) => cardMatchesFilters(c, filters));
  }, [cards, filters, activeCount]);

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

  const cardIds = useMemo(() => cards.map((c) => c.id), [cards]);

  const filtersEmpty =
    searched && !loading && cards.length > 0 && displayedCards.length === 0 && activeCount > 0;
  const searchEmpty =
    searched && !loading && cards.length === 0 && query.length >= 2;
  const showIdle = !searched && !loading && query.length < 2;

  const clearFilters = resetFilters;

  return (
    <CardInteractionsProvider cardIds={cardIds}>
    <div>
      <SearchMetrikaTracker query={query} />
      <h1 className="sr-only">Поиск промптов</h1>

      {/* Status */}
      {searched && cards.length > 0 && (
        <div className="mb-6 flex items-center gap-3">
          <h2 className="text-lg font-semibold text-zinc-900">
            Результаты по запросу &laquo;{query}&raquo;
          </h2>
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500 tabular-nums">
            {displayedCards.length}{hasMore ? "+" : ""}
          </span>
          {matchType === "trgm" && (
            <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs text-amber-700">
              Нечёткий поиск
            </span>
          )}
        </div>
      )}

      {searched && cards.length > 0 && (
        <ListingDesktopFilters
          filters={filters}
          onSetFilter={setFilter}
          onReset={resetFilters}
          activeCount={activeCount}
          hiddenDimensions={[]}
          cardsForCounts={cards}
          onOpenMobileFilters={() => setFilterPanelOpen(true)}
        />
      )}

      {/* Grid */}
      {displayedCards.length > 0 && (
        <>
        <ListingFotoVPromtBanner />
        <ListingGrid clamp={hasMore && activeCount === 0}>
          {displayedCards.map((card, index) => (
            <div key={card.id} className="min-w-0">
              <PromptCard
                card={card}
                priorityLoad={index < LISTING_LCP_PRIORITY_GRID_ITEMS}
                hideHoverChrome
              />
            </div>
          ))}
        </ListingGrid>
        </>
      )}

      {/* Autoload sentinel */}
      <div ref={sentinelRef} className="h-px" />

      {/* Loading — skeleton cards matching the grid layout (instead of a centered spinner) */}
      {loading && <ListingGridLoadingSkeleton photoOnly />}

      {/* Filter FAB */}
      {searched && cards.length > 0 && (
        <FilterFAB
          filters={filters}
          activeCount={activeCount}
          onApply={applyFilters}
          hiddenDimensions={[]}
          cardsForCounts={cards}
          open={filterPanelOpen}
          onOpenChange={setFilterPanelOpen}
        />
      )}

      {/* Empty states */}
      {filtersEmpty && (
        <SearchEmptyState variant="filters-empty" query={query} onClearFilters={clearFilters} />
      )}

      {searchEmpty && !filtersEmpty && (
        <SearchEmptyState variant="no-results" query={query} />
      )}

      {showIdle && <SearchEmptyState variant="idle" />}
    </div>
    </CardInteractionsProvider>
  );
}
