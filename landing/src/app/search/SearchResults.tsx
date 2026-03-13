"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PromptCard } from "@/components/PromptCard";
import type { PromptCardFull } from "@/lib/supabase";

const PAGE_SIZE = 20;

type Props = {
  initialQuery: string;
};

export function SearchResults({ initialQuery }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [inputValue, setInputValue] = useState(initialQuery);
  const [cards, setCards] = useState<PromptCardFull[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [matchType, setMatchType] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const doSearch = useCallback(async (q: string, append = false) => {
    if (q.length < 2) {
      if (!append) {
        setCards([]);
        setSearched(false);
      }
      return;
    }

    const newOffset = append ? offset + PAGE_SIZE : 0;
    setLoading(true);
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
      setHasMore(newCards.length === PAGE_SIZE);
      setSearched(true);
    } catch {
      if (!append) setCards([]);
    } finally {
      setLoading(false);
    }
  }, [offset]);

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
      doSearch(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = inputValue.trim();
    if (q.length >= 2) {
      setQuery(q);
      setOffset(0);
      router.push(`/search?q=${encodeURIComponent(q)}`, { scroll: false });
      doSearch(q);
    }
  };

  return (
    <div>
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
          <h1 className="text-lg font-semibold text-zinc-900">
            Результаты по запросу &laquo;{query}&raquo;
          </h1>
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500 tabular-nums">
            {cards.length}{hasMore ? "+" : ""}
          </span>
          {matchType === "trgm" && (
            <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs text-amber-700">
              Нечёткий поиск
            </span>
          )}
        </div>
      )}

      {/* Grid */}
      {cards.length > 0 && (
        <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 xl:columns-5">
          {cards.map((card) => (
            <div key={card.id} className="mb-4 break-inside-avoid">
              <PromptCard card={card} />
            </div>
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && !loading && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => doSearch(query, true)}
            className="rounded-xl border border-zinc-200 bg-white px-6 py-2.5 text-sm font-medium text-zinc-700 transition-all hover:bg-zinc-50 hover:shadow-sm active:scale-95"
          >
            Загрузить ещё
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <span className="block h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-500" />
        </div>
      )}

      {/* Empty state */}
      {searched && cards.length === 0 && !loading && (
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
          <h2 className="text-lg font-semibold text-zinc-900">
            Поиск промптов
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Введите запрос — например, «портрет», «3D стиль» или «с котом»
          </p>
        </div>
      )}
    </div>
  );
}
