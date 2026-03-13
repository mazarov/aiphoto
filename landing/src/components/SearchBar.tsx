"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { PromptCardFull } from "@/lib/supabase";

const DEBOUNCE_MS = 300;
const MIN_QUERY = 2;
const PREVIEW_LIMIT = 5;

type SearchResult = {
  cards: PromptCardFull[];
  query: string;
  matchType?: string | null;
};

const SearchIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
);

function ResultsList({
  results,
  query,
  onCardClick,
  onShowAll,
}: {
  results: PromptCardFull[];
  query: string;
  onCardClick: (slug: string) => void;
  onShowAll: () => void;
}) {
  return (
    <>
      <ul>
        {results.map((card) => (
          <li key={card.id}>
            <button
              type="button"
              onClick={() => card.slug && onCardClick(card.slug)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50 active:bg-zinc-100"
            >
              {card.photoUrls[0] ? (
                <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                  <Image src={card.photoUrls[0]} alt="" fill className="object-cover" sizes="40px" />
                </div>
              ) : (
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-400 text-xs">?</div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-zinc-900">
                  {card.title_ru || card.title_en || "Без названия"}
                </div>
                {card.promptTexts[0] && (
                  <div className="truncate text-xs text-zinc-500">
                    {card.promptTexts[0].slice(0, 60)}
                  </div>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onShowAll}
        className="flex w-full items-center justify-center gap-1.5 border-t border-zinc-100 px-4 py-2.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
      >
        Все результаты по &laquo;{query.trim()}&raquo;
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </>
  );
}

export function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PromptCardFull[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mobileActive, setMobileActive] = useState(false);
  const desktopContainerRef = useRef<HTMLDivElement>(null);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchResults = useCallback(async (q: string) => {
    if (q.length < MIN_QUERY) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=${PREVIEW_LIMIT}`);
      const data: SearchResult = await res.json();
      setResults(data.cards);
      setOpen(data.cards.length > 0 || q.trim().length >= MIN_QUERY);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchResults(value.trim()), DEBOUNCE_MS);
    },
    [fetchResults]
  );

  const closeAll = useCallback(() => {
    setOpen(false);
    setMobileActive(false);
  }, []);

  const navigateToSearch = useCallback(() => {
    const q = query.trim();
    if (q.length >= MIN_QUERY) {
      closeAll();
      router.push(`/search?q=${encodeURIComponent(q)}`);
    }
  }, [query, router, closeAll]);

  const handleCardClick = useCallback(
    (slug: string) => {
      closeAll();
      router.push(`/p/${slug}`);
    },
    [router, closeAll]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        navigateToSearch();
      }
      if (e.key === "Escape") {
        closeAll();
        desktopInputRef.current?.blur();
        mobileInputRef.current?.blur();
      }
    },
    [navigateToSearch, closeAll]
  );

  // Desktop: close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (desktopContainerRef.current && !desktopContainerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Mobile: focus input when modal opens
  useEffect(() => {
    if (mobileActive) {
      requestAnimationFrame(() => mobileInputRef.current?.focus());
    }
  }, [mobileActive]);

  // Mobile: lock body scroll when modal is open
  useEffect(() => {
    if (mobileActive) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [mobileActive]);

  const spinner = (
    <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-500" />
  );

  return (
    <>
      {/* ═══ Desktop (lg+) ═══ */}
      <div ref={desktopContainerRef} className="relative hidden lg:block">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
            <SearchIcon />
          </span>
          <input
            ref={desktopInputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => query.trim().length >= MIN_QUERY && setOpen(true)}
            placeholder="Поиск промптов..."
            className="w-56 rounded-xl border border-zinc-200 bg-zinc-50 py-1.5 pl-9 pr-3 text-sm text-zinc-700 placeholder:text-zinc-400 transition-all focus:w-72 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          {loading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">{spinner}</span>
          )}
        </div>

        {/* Desktop dropdown */}
        {open && results.length > 0 && (
          <div className="absolute right-0 z-50 mt-2 w-[340px] overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/95 shadow-2xl shadow-zinc-900/10 backdrop-blur-xl">
            <ResultsList results={results} query={query} onCardClick={handleCardClick} onShowAll={navigateToSearch} />
          </div>
        )}
        {open && results.length === 0 && query.trim().length >= MIN_QUERY && !loading && (
          <div className="absolute right-0 z-50 mt-2 w-[300px] overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/95 p-6 text-center shadow-2xl shadow-zinc-900/10 backdrop-blur-xl">
            <div className="text-sm text-zinc-500">Ничего не найдено</div>
            <div className="mt-1 text-xs text-zinc-400">Попробуйте другой запрос</div>
          </div>
        )}
      </div>

      {/* ═══ Mobile (< lg): fixed bottom bar ═══ */}
      {!mobileActive && (
        <button
          type="button"
          onClick={() => setMobileActive(true)}
          className="fixed bottom-5 left-4 right-4 z-40 flex items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white/95 px-4 py-3.5 shadow-2xl shadow-zinc-900/15 backdrop-blur-xl transition-all active:scale-[0.98] lg:hidden"
          style={{ paddingBottom: "max(0.875rem, env(safe-area-inset-bottom))" }}
        >
          <SearchIcon className="h-5 w-5 text-zinc-400" />
          <span className="text-sm text-zinc-400">Поиск промптов...</span>
        </button>
      )}

      {/* ═══ Mobile modal ═══ */}
      {mobileActive && (
        <div className="fixed inset-0 z-50 flex flex-col lg:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={closeAll} />

          {/* Results area (scrollable, grows from bottom up) */}
          <div className="relative flex flex-1 flex-col justify-end">
            {open && results.length > 0 && (
              <div className="mx-3 mb-2 max-h-[60vh] overflow-y-auto overscroll-contain rounded-2xl border border-zinc-200/80 bg-white/95 shadow-2xl backdrop-blur-xl">
                <ResultsList results={results} query={query} onCardClick={handleCardClick} onShowAll={navigateToSearch} />
              </div>
            )}
            {open && results.length === 0 && query.trim().length >= MIN_QUERY && !loading && (
              <div className="mx-3 mb-2 rounded-2xl border border-zinc-200/80 bg-white/95 p-6 text-center shadow-2xl backdrop-blur-xl">
                <div className="text-sm text-zinc-500">Ничего не найдено</div>
                <div className="mt-1 text-xs text-zinc-400">Попробуйте другой запрос</div>
              </div>
            )}
          </div>

          {/* Input bar fixed at bottom — keyboard pushes it up */}
          <div
            className="relative border-t border-zinc-200/80 bg-white px-3 pb-3 pt-2"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                  <SearchIcon />
                </span>
                <input
                  ref={mobileInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => handleChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Поиск промптов..."
                  enterKeyHint="search"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-9 pr-3 text-[16px] text-zinc-700 placeholder:text-zinc-400 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                {loading && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">{spinner}</span>
                )}
              </div>
              <button
                type="button"
                onClick={closeAll}
                className="flex-shrink-0 rounded-xl p-2.5 text-zinc-400 transition-colors active:bg-zinc-100"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
