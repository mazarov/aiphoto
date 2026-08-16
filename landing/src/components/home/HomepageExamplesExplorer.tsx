"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useListingMobileChromeOptional } from "@/context/ListingMobileChromeContext";
import { usePromptCardModal } from "@/context/PromptCardModalContext";
import { PS_HEADER_HEIGHT_FALLBACK_PX } from "@/lib/listing-header-offset";
import { getListingScrollRoot } from "@/lib/scroll-preservation";
import {
  CARD_IMAGE_LISTING_NEXT_QUALITY,
  SIZES_CARD_GRID,
} from "@/lib/card-image-presets";
import {
  getMoreChips,
  getPinnedChips,
  type HomepageExplorerChip,
} from "@/lib/homepage-explorer-chips";
import { HOMEPAGE_SEO } from "@/lib/homepage-seo-copy";
import {
  type GenerationExampleCard,
  toGenerationExampleCard,
} from "@/lib/generation/example-card";
import type { PromptCardFull } from "@/lib/supabase";

const RESULT_LIMIT = 16;
const SEARCH_DEBOUNCE_MS = 320;
const FALLBACK_CARD_ASPECT_RATIOS = [3 / 4, 4 / 5, 2 / 3, 1, 5 / 6] as const;

const CHIP_CLASS =
  "inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm font-medium transition";
const CHIP_IDLE =
  "border-indigo-100 bg-white/80 text-zinc-600 hover:border-indigo-300 hover:bg-white hover:text-indigo-700";
const CHIP_ACTIVE =
  "border-indigo-500 bg-indigo-500 text-white shadow-sm shadow-indigo-500/20";

function HomepageExampleTile({
  card,
  aspectRatio,
}: {
  card: GenerationExampleCard;
  aspectRatio: number;
}) {
  const { open, prefetchCard } = usePromptCardModal();

  return (
    <article
      className="group relative isolate overflow-hidden rounded-2xl bg-zinc-100 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-zinc-900/10"
      style={{ aspectRatio }}
    >
      {card.photoUrl ? (
        <Image
          src={card.photoUrl}
          alt={card.title}
          fill
          sizes={SIZES_CARD_GRID}
          quality={CARD_IMAGE_LISTING_NEXT_QUALITY}
          className="object-cover"
        />
      ) : (
        <div
          className="absolute inset-0 bg-gradient-to-br from-indigo-100 to-violet-100"
          aria-hidden
        />
      )}

      <Link
        href={`/p/${card.slug}`}
        className="absolute inset-0 z-10"
        aria-label={card.title}
        prefetch
        onPointerEnter={() => prefetchCard(card.slug)}
        onTouchStart={() => prefetchCard(card.slug)}
        onClick={(event) => {
          event.preventDefault();
          open(card.slug, {
            photoUrl: card.photoUrl,
            photoCount: card.photoCount,
            hasPrompts: card.hasPrompt,
          });
        }}
      />
    </article>
  );
}

function chipKey(chip: HomepageExplorerChip): string {
  return `${chip.dimension}:${chip.slug}`;
}

export function HomepageExamplesExplorer({
  initialCards,
  variant = "home",
}: {
  initialCards: GenerationExampleCard[];
  variant?: "home" | "catalog";
}) {
  const isCatalog = variant === "catalog";
  const chrome = useListingMobileChromeOptional();
  const registerCatalogSearch = chrome?.registerCatalogSearch;
  const setCatalogSearchPinned = chrome?.setCatalogSearchPinned;
  const searchSentinelRef = useRef<HTMLDivElement>(null);
  const pinnedChips = useMemo(() => getPinnedChips(), []);
  const moreChips = useMemo(() => getMoreChips(), []);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<HomepageExplorerChip | null>(
    null
  );
  const [cards, setCards] = useState(initialCards);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const setSearchQuery = useCallback((nextQuery: string) => {
    setQuery(nextQuery);
    if (nextQuery.trim()) setActiveFilter(null);
  }, []);

  const clearSearchQuery = useCallback(() => {
    setQuery("");
  }, []);

  useEffect(() => {
    if (!isCatalog || !registerCatalogSearch) return;
    registerCatalogSearch({
      value: query,
      onChange: setSearchQuery,
      onClear: clearSearchQuery,
      loading,
    });
    return () => registerCatalogSearch(null);
  }, [
    clearSearchQuery,
    isCatalog,
    loading,
    query,
    registerCatalogSearch,
    setSearchQuery,
  ]);

  useEffect(() => {
    if (!isCatalog || !setCatalogSearchPinned) return;
    const el = searchSentinelRef.current;
    if (!el) return;

    const root = getListingScrollRoot();
    const rootEl = root instanceof Element ? root : null;
    const headerH =
      Number.parseInt(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--ps-header-height"
        ),
        10
      ) || PS_HEADER_HEIGHT_FALLBACK_PX;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setCatalogSearchPinned(!entry.isIntersecting);
      },
      {
        root: rootEl,
        rootMargin: `-${headerH}px 0px 0px 0px`,
        threshold: 0,
      }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      setCatalogSearchPinned(false);
    };
  }, [isCatalog, setCatalogSearchPinned]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2 && !activeFilter) {
      setCards(initialCards);
      setLoading(false);
      setError("");
      return;
    }
    if (trimmed.length > 0 && trimmed.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(
      () => {
        setLoading(true);
        setError("");

        const endpoint =
          trimmed.length >= 2
            ? `/api/search?q=${encodeURIComponent(trimmed)}&limit=${RESULT_LIMIT}`
            : `/api/listing?${new URLSearchParams({
                [activeFilter!.dimension]: activeFilter!.slug,
                limit: String(RESULT_LIMIT),
                sort: "popular",
                strict: "1",
              })}`;

        void fetch(endpoint, {
          cache: "no-store",
          signal: controller.signal,
        })
          .then(async (response) => {
            if (!response.ok) throw new Error("search_failed");
            const payload = (await response.json()) as {
              cards?: PromptCardFull[];
            };
            setCards(
              (payload.cards ?? [])
                .map(toGenerationExampleCard)
                .slice(0, RESULT_LIMIT)
            );
          })
          .catch((fetchError: unknown) => {
            if (
              fetchError instanceof DOMException &&
              fetchError.name === "AbortError"
            ) {
              return;
            }
            setCards([]);
            setError("Не удалось загрузить подборку. Попробуйте ещё раз.");
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      },
      trimmed.length >= 2 ? SEARCH_DEBOUNCE_MS : 0
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeFilter, initialCards, query]);

  const allPromptsHref =
    query.trim().length >= 2
      ? `/search?q=${encodeURIComponent(query.trim())}`
      : activeFilter?.href || "/catalog";

  const selectChip = (chip: HomepageExplorerChip | null) => {
    setQuery("");
    setActiveFilter((current) =>
      chip && current && chipKey(current) === chipKey(chip) ? null : chip
    );
  };

  const searchFieldId = isCatalog
    ? "catalog-examples-search"
    : "homepage-examples-search";
  const showExplorerCta =
    cards.length > 0 &&
    (!isCatalog || Boolean(activeFilter) || query.trim().length >= 2);
  const explorerCtaLabel = activeFilter
    ? "Все промты категории"
    : isCatalog
      ? "Все результаты"
      : "Каталог и поиск";

  return (
    <div
      id={isCatalog ? undefined : "primery"}
      className={`overflow-hidden rounded-[1.75rem] border border-indigo-100/90 bg-[linear-gradient(145deg,#f2f1ff_0%,#ffffff_48%,#faf7ff_100%)] px-3 pt-5 text-zinc-900 shadow-[0_28px_80px_-46px_rgba(79,70,229,0.45)] sm:px-5 sm:pt-7 ${
        showExplorerCta ? "pb-0" : "pb-5 sm:pb-7"
      }`}
    >
      <div className="w-full">
        {isCatalog ? (
          <h1
            id="catalog-explorer-heading"
            className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl"
          >
            Каталог и поиск
          </h1>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
              Каталог промтов
            </p>
            <h2
              id="examples-heading"
              className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl"
            >
              {HOMEPAGE_SEO.examplesTitle}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600 sm:text-base">
              {HOMEPAGE_SEO.examplesIntro}
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600 sm:text-base">
              {HOMEPAGE_SEO.examplesIntroSecondary}
            </p>
          </>
        )}

        <label htmlFor={searchFieldId} className="sr-only">
          Найти промт для фото
        </label>
        <div
          ref={isCatalog ? searchSentinelRef : undefined}
          className="mt-5 flex min-h-12 items-center gap-3 rounded-2xl border border-indigo-100 bg-white px-4 shadow-sm transition focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-100/70"
        >
          <svg
            className="h-4 w-4 shrink-0 text-zinc-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            id={searchFieldId}
            type="search"
            value={query}
            onChange={(event) => {
              setSearchQuery(event.target.value);
            }}
            placeholder="Найти промт, стиль или сюжет"
            className="min-w-0 flex-1 bg-transparent py-3 text-base text-zinc-900 outline-none placeholder:text-zinc-400 sm:text-sm"
            autoComplete="off"
          />
          {loading ? (
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-100 border-t-indigo-500"
              aria-label="Ищем"
            />
          ) : query ? (
            <button
              type="button"
              onClick={clearSearchQuery}
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-indigo-50 hover:text-indigo-700"
              aria-label="Очистить поиск"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          ) : null}
        </div>

        <nav
          className="mt-3 flex flex-wrap gap-2"
          aria-label="Категории промтов"
        >
          <button
            type="button"
            aria-pressed={!activeFilter}
            onClick={() => selectChip(null)}
            className={`${CHIP_CLASS} ${!activeFilter ? CHIP_ACTIVE : CHIP_IDLE}`}
          >
            Все
          </button>
          {pinnedChips.map((chip) => {
            const active = activeFilter
              ? chipKey(activeFilter) === chipKey(chip)
              : false;
            return (
              <Link
                key={chipKey(chip)}
                href={chip.href}
                aria-pressed={active}
                onClick={(event) => {
                  event.preventDefault();
                  selectChip(chip);
                }}
                className={`${CHIP_CLASS} ${active ? CHIP_ACTIVE : CHIP_IDLE}`}
              >
                {chip.label}
              </Link>
            );
          })}
        </nav>

        <div className="sr-only">
          {moreChips.map((chip) => (
            <a key={chipKey(chip)} href={chip.href}>
              {chip.label}
            </a>
          ))}
        </div>

      </div>

      <div className="relative mt-5 overflow-hidden">
        <div
          className={`-mb-2 columns-2 gap-2 transition-opacity sm:-mb-3 sm:columns-3 sm:gap-3 lg:columns-4 ${
            loading ? "opacity-55" : "opacity-100"
          }`}
          aria-live="polite"
          aria-busy={loading || undefined}
        >
          {cards.map((card, index) => (
            <div key={card.id} className="mb-2 break-inside-avoid sm:mb-3">
              <HomepageExampleTile
                card={card}
                aspectRatio={
                  card.photoWidth &&
                  card.photoHeight &&
                  card.photoWidth > 0 &&
                  card.photoHeight > 0
                    ? card.photoWidth / card.photoHeight
                    : FALLBACK_CARD_ASPECT_RATIOS[
                        index % FALLBACK_CARD_ASPECT_RATIOS.length
                      ]
                }
              />
            </div>
          ))}
        </div>

        {showExplorerCta ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30">
            <div
              className="absolute inset-x-0 bottom-0 h-32 backdrop-blur-[6px] [mask-image:linear-gradient(to_top,black,transparent)] sm:h-40"
              aria-hidden
            />
            <div
              className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white/50 via-white/15 to-transparent sm:h-40"
              aria-hidden
            />
            <div className="relative flex justify-center pb-4 pt-16 sm:pb-5 sm:pt-20">
              <Link
                href={allPromptsHref}
                className="pointer-events-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-indigo-200 bg-white/95 px-5 text-sm font-semibold text-indigo-700 shadow-sm backdrop-blur-sm transition hover:border-indigo-300 hover:bg-white"
              >
                {explorerCtaLabel}
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      {!loading && cards.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center px-4 pb-8 text-center">
          <p className="text-base font-semibold text-zinc-900">
            {error || "Подходящих промтов пока не найдено"}
          </p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
            Измените формулировку или выберите другую категорию.
          </p>
        </div>
      ) : error ? (
        <p className="mt-4 pb-5 text-center text-sm text-rose-600" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
