"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PromptCard } from "@/components/PromptCard";
import { LISTING_LCP_PRIORITY_GRID_ITEMS } from "@/lib/listing-lcp";
import type { PromptCardFull } from "@/lib/supabase";
import { CardInteractionsProvider } from "@/context/CardInteractionsContext";
import { FilterFAB } from "@/components/FilterFAB";
import { useListingFilters } from "@/hooks/useListingFilters";
import type { FilterState } from "@/hooks/useListingFilters";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { filters, applyFilters, activeCount } = useListingFilters({
    baseRpcParams: {},
    lockedDimensions: [],
  });
  const [query, setQuery] = useState(initialQuery);
  const [inputValue, setInputValue] = useState(initialQuery);
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
      setInputValue(q);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = inputValue.trim();
    if (q.length >= 2) {
      setQuery(q);
      setOffset(0);
      offsetRef.current = 0;
      const sp = new URLSearchParams();
      sp.set("q", q);
      for (const [k, v] of Object.entries(filters)) {
        if (v) sp.set(k, v);
      }
      router.push(`/search?${sp.toString()}`, { scroll: false });
      doSearch(q);
    }
  };

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

  return (
    <CardInteractionsProvider cardIds={cardIds}>
    <div>
      <h1 className="sr-only">Поиск промптов</h1>
      {/* Search input */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="relative mx-auto max-w-xl">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </span>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Введите запрос — например, «портрет девушки» или «GTA стиль»"
            className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 py-3.5 pl-12 pr-24 text-base text-zinc-700 placeholder:text-zinc-400 transition-all focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
            autoFocus
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-indigo-500 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-indigo-600 active:scale-95"
          >
            Найти
          </button>
        </div>
      </form>

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

      {/* Empty state */}
      {searched && displayedCards.length === 0 && !loading && (
        <div className="mx-auto max-w-md py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100">
            <svg className="h-7 w-7 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-zinc-900">
            По запросу &laquo;{query}&raquo; ничего не найдено
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Попробуйте изменить запрос или перейдите в категории на главной
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-xl bg-indigo-500 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-600"
          >
            На главную
          </Link>
        </div>
      )}

      {/* Initial state */}
      {!searched && !loading && (
        <div className="mx-auto max-w-md py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
            <svg className="h-7 w-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-zinc-900">
            Поиск промптов
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Введите запрос — например, «портрет», «3D стиль» или «с котом»
          </p>
        </div>
      )}
    </div>
    </CardInteractionsProvider>
  );
}
