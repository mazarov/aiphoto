"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import {
  CARD_IMAGE_LISTING_NEXT_QUALITY,
  SIZES_CARD_GRID,
} from "@/lib/card-image-presets";
import type { PromptCardFull } from "@/lib/supabase";

const DEBOUNCE_MS = 300;
const MIN_QUERY = 2;
const PREVIEW_LIMIT = 5;

const POPULAR_QUERIES = [
  "портрет", "GTA", "аниме", "на море", "с котом", "Love Is", "3D",
];

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

function ResultCard({
  card,
  onClick,
}: {
  card: PromptCardFull;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3.5 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-zinc-50 active:bg-zinc-100/80"
    >
      {card.photoUrls[0] ? (
        <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-zinc-100 ring-1 ring-zinc-900/5">
          <Image
            src={card.photoUrls[0]}
            alt=""
            fill
            className="object-cover"
            sizes={SIZES_CARD_GRID}
            quality={CARD_IMAGE_LISTING_NEXT_QUALITY}
          />
        </div>
      ) : (
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-300">
          <SearchIcon className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium text-zinc-900 leading-tight">
          {card.title_ru || card.title_en || "Без названия"}
        </div>
        {card.promptTexts[0] && (
          <div className="mt-0.5 truncate text-[12px] leading-tight text-zinc-400">
            {card.promptTexts[0].slice(0, 70)}
          </div>
        )}
      </div>
      <svg className="h-4 w-4 flex-shrink-0 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

export function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const hideMobileBar = pathname === "/" || pathname.startsWith("/search") || pathname.startsWith("/p/");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PromptCardFull[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mobileActive, setMobileActive] = useState(false);
  const desktopRef = useRef<HTMLDivElement>(null);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchResults = useCallback(async (q: string) => {
    if (q.length < MIN_QUERY) {
      setResults([]);
      setShowResults(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=${PREVIEW_LIMIT}`);
      const data: SearchResult = await res.json();
      setResults(data.cards);
      setShowResults(true);
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
      if (value.trim().length < MIN_QUERY) {
        setResults([]);
        setShowResults(false);
      } else {
        debounceRef.current = setTimeout(() => fetchResults(value.trim()), DEBOUNCE_MS);
      }
    },
    [fetchResults]
  );

  const closeAll = useCallback(() => {
    setShowResults(false);
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

  const handleQuickSearch = useCallback(
    (q: string) => {
      setQuery(q);
      closeAll();
      router.push(`/search?q=${encodeURIComponent(q)}`);
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

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (desktopRef.current && !desktopRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (mobileActive) {
      requestAnimationFrame(() => mobileInputRef.current?.focus());
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [mobileActive]);

  // ⌘K shortcut (desktop)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (window.innerWidth >= 1024) {
          desktopInputRef.current?.focus();
        } else {
          setMobileActive(true);
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const hasQuery = query.trim().length >= MIN_QUERY;
  const noResults = showResults && results.length === 0 && hasQuery && !loading;

  const spinner = (
    <span className="block h-4 w-4 animate-spin rounded-full border-[2px] border-zinc-200 border-t-indigo-500" />
  );

  return (
    <>
      {/* ═══════════ Desktop (lg+) ═══════════ */}
      <div ref={desktopRef} className="relative hidden w-full max-w-xl lg:block">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
            <SearchIcon />
          </span>
          <input
            ref={desktopInputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => hasQuery && results.length > 0 && setShowResults(true)}
            placeholder="Поиск промтов..."
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50/80 py-2 pl-10 pr-14 text-sm text-zinc-700 placeholder:text-zinc-400 transition-all duration-200 focus:border-indigo-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:shadow-lg focus:shadow-indigo-500/5"
          />
          {loading ? (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">{spinner}</span>
          ) : (
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
              ⌘K
            </kbd>
          )}
        </div>

        {/* Desktop dropdown */}
        {showResults && results.length > 0 && (
          <div className="animate-scale-in absolute left-0 right-0 z-50 mt-2 min-w-[380px] overflow-hidden rounded-2xl border border-zinc-200/60 bg-white shadow-2xl shadow-zinc-900/10">
            <div className="p-1.5">
              {results.map((card) => (
                <ResultCard
                  key={card.id}
                  card={card}
                  onClick={() => card.slug && handleCardClick(card.slug)}
                />
              ))}
            </div>
            <div className="border-t border-zinc-100">
              <button
                type="button"
                onClick={navigateToSearch}
                className="flex w-full items-center justify-center gap-2 px-4 py-3 text-[13px] font-medium text-indigo-600 transition-colors hover:bg-indigo-50/50 active:bg-indigo-50"
              >
                Показать все результаты
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {noResults && (
          <div className="animate-scale-in absolute left-0 right-0 z-50 mt-2 min-w-[320px] overflow-hidden rounded-2xl border border-zinc-200/60 bg-white p-8 text-center shadow-2xl shadow-zinc-900/10">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100">
              <SearchIcon className="h-4 w-4 text-zinc-400" />
            </div>
            <div className="text-sm font-medium text-zinc-600">Ничего не найдено</div>
            <div className="mt-1 text-xs text-zinc-400">Попробуйте другой запрос</div>
          </div>
        )}
      </div>

      {/* ═══════════ Mobile elements via portal (escape header's backdrop-filter containing block) ═══════════ */}
      {mounted && createPortal(
        <>
          {/* Mobile: fake search bar trigger */}
          {!mobileActive && !hideMobileBar && (
            <button
              type="button"
              onClick={() => setMobileActive(true)}
              className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 flex h-12 w-[188px] items-center justify-center gap-2.5 rounded-full bg-zinc-900 px-4 text-white shadow-lg transition-transform active:scale-[0.98] sm:bottom-6 sm:w-[220px] lg:hidden"
              aria-label="Поиск"
            >
              <SearchIcon className="h-4 w-4 text-white/80" />
              <span className="truncate text-[13px] font-medium text-white">Найти промпт</span>
            </button>
          )}

          {/* Mobile modal */}
          {mobileActive && (
            <div className="fixed inset-0 z-50 flex flex-col lg:hidden">
              {/* Backdrop */}
              <div className="animate-fade-in absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={closeAll} />

              {/* Content area — results grow from bottom */}
              <div className="relative flex flex-1 flex-col justify-end pb-0">
                {/* Results panel */}
                {showResults && results.length > 0 && (
                  <div className="animate-slide-up mx-3 mb-2 max-h-[55vh] overflow-y-auto overscroll-contain rounded-2xl border border-white/60 bg-white shadow-[0_8px_40px_-8px_rgba(0,0,0,0.15)]">
                    <div className="p-1.5">
                      {results.map((card) => (
                        <ResultCard
                          key={card.id}
                          card={card}
                          onClick={() => card.slug && handleCardClick(card.slug)}
                        />
                      ))}
                    </div>
                    <div className="border-t border-zinc-100">
                      <button
                        type="button"
                        onClick={navigateToSearch}
                        className="flex w-full items-center justify-center gap-2 px-4 py-3.5 text-[13px] font-medium text-indigo-600 transition-colors active:bg-indigo-50"
                      >
                        Показать все результаты
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {/* No results */}
                {noResults && (
                  <div className="animate-slide-up mx-3 mb-2 rounded-2xl border border-white/60 bg-white p-8 text-center shadow-[0_8px_40px_-8px_rgba(0,0,0,0.15)]">
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100">
                      <SearchIcon className="h-4 w-4 text-zinc-400" />
                    </div>
                    <div className="text-sm font-medium text-zinc-600">Ничего не найдено</div>
                    <div className="mt-1 text-xs text-zinc-400">Попробуйте другой запрос</div>
                  </div>
                )}

                {/* Popular searches — shown when no query */}
                {!hasQuery && !loading && (
                  <div className="animate-slide-up mx-3 mb-2 rounded-2xl border border-white/60 bg-white p-5 shadow-[0_8px_40px_-8px_rgba(0,0,0,0.15)]">
                    <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
                      Популярные запросы
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {POPULAR_QUERIES.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => handleQuickSearch(q)}
                          className="rounded-full border border-zinc-200 bg-zinc-50 px-3.5 py-1.5 text-[13px] font-medium text-zinc-600 transition-colors active:bg-zinc-100 active:border-zinc-300"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom input bar */}
              <div
                className="animate-slide-up-sheet relative bg-white px-4 pb-4 pt-3"
                style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                      <SearchIcon className="h-[18px] w-[18px]" />
                    </span>
                    <input
                      ref={mobileInputRef}
                      type="text"
                      value={query}
                      onChange={(e) => handleChange(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Найти промт..."
                      enterKeyHint="search"
                      autoComplete="off"
                      autoCorrect="off"
                      className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 py-3 pl-10 pr-4 text-[16px] text-zinc-800 placeholder:text-zinc-400 transition-colors focus:border-indigo-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
                    />
                    {loading && (
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2">{spinner}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={closeAll}
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 transition-colors active:bg-zinc-200"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </>,
        document.body
      )}
    </>
  );
}
