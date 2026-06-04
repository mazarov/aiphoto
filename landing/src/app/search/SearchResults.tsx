"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { PromptCard } from "@/components/PromptCard";
import { LISTING_LCP_PRIORITY_GRID_ITEMS } from "@/lib/listing-lcp";
import type { PromptCardFull } from "@/lib/supabase";
import { CardInteractionsProvider } from "@/context/CardInteractionsContext";
import { FilterFAB } from "@/components/FilterFAB";
import { useListingFilters } from "@/hooks/useListingFilters";
import type { FilterState } from "@/hooks/useListingFilters";
import { resetListingScroll, useListingScrollRestoration } from "@/lib/scroll-preservation";
import { writeListingNavigationContext } from "@/lib/listing-card-navigation-context";
import { SearchEmptyState } from "@/components/SearchEmptyState";
import { SearchMetrikaTracker } from "@/components/YandexMetrikaRouteTracker";
import { ListingFotoVPromtBanner } from "@/components/foto-v-promt-promo/ListingFotoVPromtBanner";

const PAGE_SIZE = 24;

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
  const { filters, applyFilters, activeCount } = useListingFilters({
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
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(false);
  const offsetRef = useRef(0);
  const queryRef = useRef(query);

  // Centralized scroll restoration when returning from card modal / client modal.
  // Replaces previous duplicated inline logic.
  useListingScrollRestoration();

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
        `/api/search?q=${encodeURIComponent(q)}&limit=${PAGE_SIZE}&offset=${newOffset}`
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

  // Write navigation context so that when a card is opened from search results
  // (via the client modal), the left/right arrows have the correct neighbor slugs
  // in the *current filtered* order. Re-runs on client-side filter changes too.
  useEffect(() => {
    if (displayedCards.length > 0) {
      const slugs = displayedCards.map((c) => c.slug).filter((s): s is string => !!s);
      if (slugs.length > 0) {
        writeListingNavigationContext(slugs);
      }
    }
  }, [displayedCards]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingRef.current && hasMoreRef.current) {
          doSearch(queryRef.current, true);
        }
      },
      { rootMargin: "400px" }
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

  const clearFilters = () => {
    applyFilters({
      audience: null,
      style: null,
      occasion: null,
      object: null,
    });
  };

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

      {/* Grid */}
      {displayedCards.length > 0 && (
        <>
        <ListingFotoVPromtBanner />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {displayedCards.map((card, index) => (
            <div key={card.id} className="min-w-0">
              <PromptCard
                card={card}
                priorityLoad={index < LISTING_LCP_PRIORITY_GRID_ITEMS}
              />
            </div>
          ))}
        </div>
        </>
      )}

      {/* Autoload sentinel */}
      <div ref={sentinelRef} className="h-px" />

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <span className="block h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-500" />
        </div>
      )}

      {/* Filter FAB */}
      {searched && cards.length > 0 && (
        <FilterFAB
          filters={filters}
          activeCount={activeCount}
          onApply={applyFilters}
          hiddenDimensions={[]}
          cardsForCounts={cards}
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
