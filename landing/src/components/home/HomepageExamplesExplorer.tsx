"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ListingExplorerFrame } from "@/components/ListingExplorerFrame";
import {
  ListingExplorerHeading,
  ListingExplorerSearch,
} from "@/components/ListingExplorerSearch";
import { ListingMasonry, ListingMasonryItem } from "@/components/ListingMasonry";
import { ListingPhotoTile } from "@/components/ListingPhotoTile";
import { useListingMobileChromeOptional } from "@/context/ListingMobileChromeContext";
import { PS_HEADER_HEIGHT_FALLBACK_PX } from "@/lib/listing-header-offset";
import { getListingScrollRoot } from "@/lib/scroll-preservation";
import {
  getMoreChips,
  getPinnedChips,
  type HomepageExplorerChip,
} from "@/lib/homepage-explorer-chips";
import { HOMEPAGE_SEO } from "@/lib/homepage-seo-copy";
import {
  type GenerationExampleCard,
  toGenerationExampleCard,
  writeGenerationExampleNavigation,
} from "@/lib/generation/example-card";
import { listingPhotoAspectRatio } from "@/lib/listing-masonry";
import type { PromptCardFull } from "@/lib/supabase";

const RESULT_LIMIT = 16;
const SEARCH_DEBOUNCE_MS = 500;

const CHIP_CLASS =
  "inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm font-medium transition";
const CHIP_IDLE =
  "border-indigo-100 bg-white/80 text-zinc-600 hover:border-indigo-300 hover:bg-white hover:text-indigo-700";
const CHIP_ACTIVE =
  "border-indigo-500 bg-indigo-500 text-white shadow-sm shadow-indigo-500/20";

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

  useLayoutEffect(() => {
    if (cards.length > 0) writeGenerationExampleNavigation(cards);
  }, [cards]);

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
                sort: isCatalog ? "popular" : "new",
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
  }, [activeFilter, initialCards, isCatalog, query]);

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
    <ListingExplorerFrame
      id={isCatalog ? undefined : "primery"}
      className={showExplorerCta ? "pb-0" : "pb-5 sm:pb-7"}
    >
      {isCatalog ? (
        <ListingExplorerHeading
          title="Каталог и поиск"
          titleAs="h1"
          titleId="catalog-explorer-heading"
        />
      ) : (
        <ListingExplorerHeading
          eyebrow="Каталог промтов"
          title={HOMEPAGE_SEO.examplesTitle}
          titleAs="h2"
          titleId="examples-heading"
          intro={HOMEPAGE_SEO.examplesIntro}
          introSecondary={HOMEPAGE_SEO.examplesIntroSecondary}
        />
      )}

      <ListingExplorerSearch
        id={searchFieldId}
        value={query}
        onChange={setSearchQuery}
        onClear={clearSearchQuery}
        loading={loading}
        sentinelRef={isCatalog ? searchSentinelRef : undefined}
      />

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

      <div className="relative mt-5 overflow-hidden">
        <ListingMasonry loading={loading}>
          {cards.map((card, index) => (
            <ListingMasonryItem key={card.id}>
              <ListingPhotoTile
                card={card}
                aspectRatio={listingPhotoAspectRatio(
                  card.photoWidth,
                  card.photoHeight,
                  index
                )}
              />
            </ListingMasonryItem>
          ))}
        </ListingMasonry>

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
    </ListingExplorerFrame>
  );
}
