"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ListingMasonry, ListingMasonryItem } from "@/components/ListingMasonry";
import { ListingPhotoTile } from "@/components/ListingPhotoTile";
import {
  type GenerationExampleCard,
  filterExampleCardsByQuery,
  toGenerationExampleCard,
  writeGenerationExampleNavigation,
} from "@/lib/generation/example-card";
import { listingPhotoAspectRatio } from "@/lib/listing-masonry";
import type { PromptCardFull } from "@/lib/supabase";
import type { GeneraciyaFotoChipNavItem } from "@/lib/generaciya-foto-chip-nav";
import {
  GENERACIYA_FOTO_SCENARIOS,
  GENERACIYA_FOTO_SEO,
} from "@/lib/generaciya-foto-seo-copy";
import { appendUniqueCardPage } from "@/lib/listing-cards";
import {
  LISTING_INFINITE_PAGE_SIZE,
  LISTING_SEARCH_PAGE_SIZE,
  hasMoreRankedPages,
  hasMoreSearchPages,
  resolveListingPageStep,
} from "@/lib/listing-pagination";
import { LISTING_SHELL_LINK_SCROLL } from "@/lib/scroll-preservation";
import {
  GF_BLOCK_FLUSH,
  GF_H2,
  GF_LEAD,
} from "@/components/generate/generaciya-foto-ui";

const RESULT_LIMIT = 16;
const SEARCH_DEBOUNCE_MS = 500;

export type ExamplesExplorerLoadMore = {
  rpcParams: Record<string, string | null>;
  totalCount: number;
  initialRankedBatchSize: number;
  strict?: boolean;
};

type QuickFilter = (typeof GENERACIYA_FOTO_SCENARIOS)[number];

const SCENARIO_CHIP =
  "inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm font-medium transition";
const SCENARIO_CHIP_ACTIVE =
  "border-indigo-500 bg-indigo-500 text-white shadow-sm shadow-indigo-500/20";
const SCENARIO_CHIP_IDLE =
  "border-indigo-100 bg-white/80 text-zinc-600 hover:border-indigo-300 hover:bg-white hover:text-indigo-700";
const HUB_CHIP =
  "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition";
const HUB_CHIP_ACTIVE = "border-zinc-900 bg-zinc-900 text-white shadow-sm";
const HUB_CHIP_IDLE =
  "border-zinc-300 bg-zinc-100 text-zinc-800 hover:border-zinc-400 hover:bg-zinc-200";

const LOAD_MORE_BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-indigo-200 bg-white/95 px-5 text-sm font-semibold text-indigo-700 shadow-sm backdrop-blur-sm transition hover:border-indigo-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60";

function HubChipIcon({ back }: { back: boolean }) {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      {back ? (
        <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </>
      )}
    </svg>
  );
}

function LoadMoreChevron({ direction }: { direction: "down" | "left" }) {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      {direction === "down" ? (
        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="m9 18 6-6-6-6" />
      )}
    </svg>
  );
}

function matchesQuickFilter(
  card: GenerationExampleCard,
  filter: QuickFilter
): boolean {
  return (card.seoTags[filter.dimension] || []).includes(filter.value);
}

export function GeneraciyaFotoExamplesExplorer({
  initialCards,
  title = GENERACIYA_FOTO_SEO.examplesTitle,
  intro = GENERACIYA_FOTO_SEO.examplesIntro,
  eyebrow = "Библиотека образов",
  allPromptsLabel = GENERACIYA_FOTO_SEO.examplesCta,
  defaultAllPromptsHref = GENERACIYA_FOTO_SEO.examplesMoreHref,
  scenarioNavigation,
  navigationAriaLabel,
  lockCardsToScenario = false,
  restrictToInitialCards = false,
  loadMoreListing,
}: {
  initialCards: GenerationExampleCard[];
  title?: string;
  intro?: string;
  eyebrow?: string;
  allPromptsLabel?: string;
  defaultAllPromptsHref?: string;
  scenarioNavigation?: GeneraciyaFotoChipNavItem[];
  navigationAriaLabel?: string;
  lockCardsToScenario?: boolean;
  restrictToInitialCards?: boolean;
  loadMoreListing?: ExamplesExplorerLoadMore;
}) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<QuickFilter | null>(null);
  const [cardPages, setCardPages] = useState<GenerationExampleCard[][]>(() => [
    initialCards,
  ]);
  const cards = cardPages.flat();
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [galleryRevealed, setGalleryRevealed] = useState(false);
  const [hasMore, setHasMore] = useState(() =>
    loadMoreListing
      ? hasMoreRankedPages(
          loadMoreListing.initialRankedBatchSize,
          loadMoreListing.initialRankedBatchSize,
          loadMoreListing.totalCount
        )
      : false
  );
  const [error, setError] = useState("");
  const usesScenarioNavigation = Boolean(scenarioNavigation?.length);
  const lockedToScenario = usesScenarioNavigation && lockCardsToScenario;
  const inlineLoadMore = Boolean(loadMoreListing);
  const rankedOffsetRef = useRef(loadMoreListing?.initialRankedBatchSize ?? 0);
  const totalCountRef = useRef(loadMoreListing?.totalCount ?? 0);
  const hasMoreRef = useRef(hasMore);
  const loadingMoreRef = useRef(false);
  const hasExpandedRef = useRef(false);

  hasMoreRef.current = hasMore;

  const replaceCardPages = useCallback((nextCards: GenerationExampleCard[]) => {
    setCardPages([nextCards]);
  }, []);

  useEffect(() => {
    if (cards.length > 0) writeGenerationExampleNavigation(cards);
  }, [cards]);

  useEffect(() => {
    if (hasExpandedRef.current) return;
    replaceCardPages(initialCards);
    if (!loadMoreListing) return;
    rankedOffsetRef.current = loadMoreListing.initialRankedBatchSize;
    totalCountRef.current = loadMoreListing.totalCount;
    setGalleryRevealed(false);
    setLoadMoreError(false);
    setHasMore(
      hasMoreRankedPages(
        loadMoreListing.initialRankedBatchSize,
        loadMoreListing.initialRankedBatchSize,
        loadMoreListing.totalCount
      )
    );
  }, [initialCards, loadMoreListing, replaceCardPages]);

  const fetchListingPage = useCallback(
    async (searchQuery: string) => {
      if (!loadMoreListing) return false;

      const trimmed = searchQuery.trim();
      const pageSize = trimmed
        ? LISTING_SEARCH_PAGE_SIZE
        : LISTING_INFINITE_PAGE_SIZE;
      const oldOffset = rankedOffsetRef.current;
      const sp = new URLSearchParams();
      sp.set("limit", String(pageSize));
      sp.set("offset", String(oldOffset));

      if (trimmed) {
        sp.set("q", trimmed);
      } else {
        for (const [key, value] of Object.entries(loadMoreListing.rpcParams)) {
          if (value) sp.set(key, value);
        }
        if (loadMoreListing.strict) sp.set("strict", "1");
      }

      const response = await fetch(`/api/listing?${sp.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("listing_request_failed");

      const data = (await response.json()) as {
        cards?: PromptCardFull[];
        total_count?: number;
        ranked_batch_size?: number;
        has_more?: boolean;
      };
      const newCards = (data.cards ?? []).map(toGenerationExampleCard);
      const rankedSize = Math.max(0, Number(data.ranked_batch_size) || 0);
      const apiTotal = Number(data.total_count);
      if (Number.isFinite(apiTotal) && apiTotal >= 0) {
        totalCountRef.current = apiTotal;
      }

      if (rankedSize === 0 && newCards.length === 0) {
        setHasMore(false);
        hasMoreRef.current = false;
        return false;
      }

      const step = trimmed
        ? rankedSize || newCards.length
        : resolveListingPageStep(rankedSize);
      if (newCards.length > 0) {
        setCardPages((prev) => appendUniqueCardPage(prev, newCards));
      }
      rankedOffsetRef.current = oldOffset + step;

      const more = trimmed
        ? typeof data.has_more === "boolean"
          ? data.has_more
          : hasMoreSearchPages(rankedSize || newCards.length, pageSize)
        : hasMoreRankedPages(oldOffset, step, totalCountRef.current);
      setHasMore(more);
      hasMoreRef.current = more;
      return more;
    },
    [loadMoreListing]
  );

  const loadMoreCards = useCallback(
    async (searchQuery = query) => {
      if (!inlineLoadMore || loadingMoreRef.current || !hasMoreRef.current) {
        return;
      }

      loadingMoreRef.current = true;
      setLoadingMore(true);
      setLoadMoreError(false);
      setGalleryRevealed(true);
      hasExpandedRef.current = true;

      try {
        await fetchListingPage(searchQuery);
      } catch {
        setLoadMoreError(true);
      } finally {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    },
    [fetchListingPage, inlineLoadMore, query]
  );

  useEffect(() => {
    const trimmed = query.trim();
    if (restrictToInitialCards) {
      replaceCardPages(filterExampleCardsByQuery(initialCards, trimmed));
      setLoading(false);
      setError("");
      return;
    }

    if (inlineLoadMore && trimmed.length >= 2) {
      rankedOffsetRef.current = 0;
      setGalleryRevealed(true);
      hasExpandedRef.current = true;
      const controller = new AbortController();
      const timer = window.setTimeout(() => {
        setLoading(true);
        setError("");
        void fetch(
          `/api/listing?q=${encodeURIComponent(trimmed)}&limit=${LISTING_SEARCH_PAGE_SIZE}&offset=0`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        )
          .then(async (response) => {
            if (!response.ok) throw new Error("search_failed");
            const payload = (await response.json()) as {
              cards?: PromptCardFull[];
              ranked_batch_size?: number;
              has_more?: boolean;
            };
            const nextCards = (payload.cards ?? []).map(toGenerationExampleCard);
            replaceCardPages(nextCards);
            const rankedSize = Math.max(
              0,
              Number(payload.ranked_batch_size) || nextCards.length
            );
            rankedOffsetRef.current = rankedSize;
            const more =
              typeof payload.has_more === "boolean"
                ? payload.has_more
                : hasMoreSearchPages(rankedSize, LISTING_SEARCH_PAGE_SIZE);
            setHasMore(more);
            hasMoreRef.current = more;
          })
          .catch((fetchError: unknown) => {
            if (
              fetchError instanceof DOMException &&
              fetchError.name === "AbortError"
            ) {
              return;
            }
            setCardPages([]);
            setHasMore(false);
            setError("Не удалось загрузить подборку. Попробуйте ещё раз.");
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      }, SEARCH_DEBOUNCE_MS);

      return () => {
        window.clearTimeout(timer);
        controller.abort();
      };
    }

    if (lockedToScenario && trimmed.length < 2) {
      if (!hasExpandedRef.current) {
        replaceCardPages(initialCards);
      }
      setLoading(false);
      setError("");
      if (loadMoreListing && !hasExpandedRef.current) {
        rankedOffsetRef.current = loadMoreListing.initialRankedBatchSize;
        totalCountRef.current = loadMoreListing.totalCount;
        setGalleryRevealed(false);
        setHasMore(
          hasMoreRankedPages(
            loadMoreListing.initialRankedBatchSize,
            loadMoreListing.initialRankedBatchSize,
            loadMoreListing.totalCount
          )
        );
      }
      return;
    }

    if (trimmed.length < 2 && !activeFilter) {
      if (!hasExpandedRef.current) {
        replaceCardPages(initialCards);
      }
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
                [activeFilter!.dimension]: activeFilter!.value,
                limit: String(RESULT_LIMIT),
                sort: "new",
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
            const nextCards = (payload.cards ?? []).map(
              toGenerationExampleCard
            );
            replaceCardPages(
              trimmed.length < 2 && activeFilter
                ? nextCards
                    .filter((card) =>
                      matchesQuickFilter(card, activeFilter)
                    )
                    .slice(0, RESULT_LIMIT)
                : nextCards.slice(0, RESULT_LIMIT)
            );
          })
          .catch((fetchError: unknown) => {
            if (
              fetchError instanceof DOMException &&
              fetchError.name === "AbortError"
            ) {
              return;
            }
            setCardPages([]);
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
  }, [
    activeFilter,
    initialCards,
    inlineLoadMore,
    loadMoreListing,
    lockedToScenario,
    query,
    replaceCardPages,
  ]);

  const allPromptsHref =
    query.trim().length >= 2
      ? `/search?q=${encodeURIComponent(query.trim())}`
      : activeFilter?.href || defaultAllPromptsHref;

  const showTeaserOverlay =
    inlineLoadMore &&
    hasMore &&
    !galleryRevealed &&
    !query.trim() &&
    cards.length > 0 &&
    !restrictToInitialCards;

  const showInlineLoadMoreButton =
    inlineLoadMore &&
    hasMore &&
    (galleryRevealed || query.trim().length >= 2) &&
    !restrictToInitialCards;

  const loadMoreBusy = loadingMore;

  let cardOffset = 0;

  return (
    <div className={GF_BLOCK_FLUSH}>
      <div className="w-full">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
            {eyebrow}
          </p>
        ) : null}
        <h2 id="examples-heading" className={`${eyebrow ? "mt-2 " : ""}${GF_H2}`}>
          {title}
        </h2>
        <p className={GF_LEAD}>{intro}</p>

        <>
          <label htmlFor="generation-examples-search" className="sr-only">
            Найти промт для фото
          </label>
          <div className="mt-5 flex min-h-12 items-center gap-3 rounded-2xl border border-indigo-100 bg-white px-4 shadow-sm transition focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-100/70">
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
              id="generation-examples-search"
              type="search"
              value={query}
              onChange={(event) => {
                const nextQuery = event.target.value;
                setQuery(nextQuery);
                if (nextQuery.trim()) setActiveFilter(null);
              }}
              placeholder="Найти образ, стиль или сюжет"
              className="min-w-0 flex-1 bg-transparent py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
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
                onClick={() => setQuery("")}
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
        </>

        <nav
          className="mt-3 flex flex-wrap gap-2"
          aria-label={
            navigationAriaLabel ??
            (usesScenarioNavigation
              ? "Другие генераторы фото"
              : "Быстрые подборки промтов")
          }
        >
          {usesScenarioNavigation
            ? scenarioNavigation!.map((item) =>
                item.kind === "hub" ? (
                  <Link
                    key={item.href}
                    href={item.href}
                    scroll={LISTING_SHELL_LINK_SCROLL}
                    aria-current={item.active ? "page" : undefined}
                    aria-label={GENERACIYA_FOTO_SEO.chipHubAria}
                    className={`${HUB_CHIP} ${
                      item.active ? HUB_CHIP_ACTIVE : HUB_CHIP_IDLE
                    }`}
                  >
                    <HubChipIcon back={!item.active} />
                    {item.label}
                  </Link>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    scroll={LISTING_SHELL_LINK_SCROLL}
                    aria-current={item.active ? "page" : undefined}
                    className={`${SCENARIO_CHIP} ${
                      item.active ? SCENARIO_CHIP_ACTIVE : SCENARIO_CHIP_IDLE
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              )
            : GENERACIYA_FOTO_SCENARIOS.map((filter) => {
                const active = activeFilter?.value === filter.value;
                return (
                  <Link
                    key={filter.value}
                    href={filter.href}
                    scroll={LISTING_SHELL_LINK_SCROLL}
                    aria-current={active ? "true" : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      setQuery("");
                      setActiveFilter(active ? null : filter);
                    }}
                    className={`${SCENARIO_CHIP} ${
                      active ? SCENARIO_CHIP_ACTIVE : SCENARIO_CHIP_IDLE
                    }`}
                  >
                    {filter.label}
                  </Link>
                );
              })}
        </nav>
      </div>

      <div className={`relative mt-5 ${showTeaserOverlay || (!inlineLoadMore && cards.length > 0 && !restrictToInitialCards) ? "overflow-hidden" : ""}`}>
        {cardPages.map((page, pageIndex) => {
          const pageOffset = cardOffset;
          cardOffset += page.length;
          return (
            <ListingMasonry
              key={`examples-page-${pageIndex}`}
              loading={loading && pageIndex === 0}
              className={pageIndex > 0 ? "mt-2 sm:mt-3" : undefined}
            >
              {page.map((card, index) => (
                <ListingMasonryItem key={card.id}>
                  <ListingPhotoTile
                    card={card}
                    aspectRatio={listingPhotoAspectRatio(
                      card.photoWidth,
                      card.photoHeight,
                      pageOffset + index
                    )}
                  />
                </ListingMasonryItem>
              ))}
            </ListingMasonry>
          );
        })}

        {showTeaserOverlay ? (
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
              <button
                type="button"
                disabled={loadMoreBusy}
                onClick={() => void loadMoreCards()}
                className={`pointer-events-auto ${LOAD_MORE_BUTTON}`}
              >
                {loadMoreBusy ? "Загружаем…" : allPromptsLabel}
                <LoadMoreChevron direction="down" />
              </button>
            </div>
          </div>
        ) : null}

        {!inlineLoadMore && cards.length > 0 && !restrictToInitialCards ? (
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
                scroll={LISTING_SHELL_LINK_SCROLL}
                className={`pointer-events-auto ${LOAD_MORE_BUTTON}`}
              >
                {allPromptsLabel}
                <LoadMoreChevron direction="left" />
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      {showInlineLoadMoreButton ? (
        <div className="mt-5 flex flex-col items-center gap-3">
          <button
            type="button"
            disabled={loadMoreBusy}
            onClick={() => void loadMoreCards()}
            className={LOAD_MORE_BUTTON}
          >
            {loadMoreBusy ? "Загружаем…" : "Показать ещё"}
            <LoadMoreChevron direction="down" />
          </button>
          {loadMoreError ? (
            <p className="text-sm text-rose-600" role="status">
              Не удалось загрузить карточки. Попробуйте ещё раз.
            </p>
          ) : null}
        </div>
      ) : null}

      {!loading && cards.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center px-4 pb-8 text-center">
          <p className="text-base font-semibold text-zinc-900">
            {error || "Подходящих промтов пока не найдено"}
          </p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
            {restrictToInitialCards
              ? "Измените формулировку. В этом блоке только ИИ-фотосессии."
              : "Измените формулировку или выберите одну из быстрых подборок."}
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
