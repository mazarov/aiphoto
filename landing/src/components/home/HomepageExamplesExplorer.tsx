"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDebugCardHidden } from "@/hooks/useDebugCardHidden";
import { omitCardFromPages, omitHiddenCardIds } from "@/lib/debug-hide-card";
import {
  ListingExplorerHeading,
  ListingExplorerSearch,
} from "@/components/ListingExplorerSearch";
import { GF_BLOCK_FLUSH } from "@/components/generate/generaciya-foto-ui";
import { ListingMasonry } from "@/components/ListingMasonry";
import { ListingPhotoTile } from "@/components/ListingPhotoTile";
import {
  getPinnedChips,
  type HomepageExplorerChip,
} from "@/lib/homepage-explorer-chips";
import { HOMEPAGE_SEO } from "@/lib/homepage-seo-copy";
import {
  type GenerationExampleCard,
  toGenerationExampleCard,
  writeGenerationExampleNavigation,
} from "@/lib/generation/example-card";
import {
  HOME_ALL_FEED,
  homeFeedQuery,
  homeFeedUrl,
  readHomeFeedPage,
  type HomeFeedQuery,
} from "@/lib/home-explorer-feed";
import { appendUniqueCardPage } from "@/lib/listing-cards";
import { listingPhotoAspectRatio } from "@/lib/listing-masonry";
import {
  hasMoreListingFromOffset,
  LISTING_INFINITE_PAGE_SIZE,
  LISTING_LOAD_MORE_LABEL,
} from "@/lib/listing-pagination";
import type { PromptCardFull } from "@/lib/supabase";

const RESULT_LIMIT = 16;
const SEARCH_DEBOUNCE_MS = 500;

const CHIP_CLASS =
  "inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm font-medium transition";
const CHIP_IDLE =
  "border-indigo-100 bg-white/80 text-zinc-600 hover:border-indigo-300 hover:bg-white hover:text-indigo-700";
const CHIP_ACTIVE =
  "border-indigo-500 bg-indigo-500 text-white shadow-sm shadow-indigo-500/20";
const LOAD_MORE_BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-indigo-200 bg-white/95 px-5 text-sm font-semibold text-indigo-700 shadow-sm backdrop-blur-sm transition hover:border-indigo-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60";

type FeedCursor = { feed: HomeFeedQuery; offset: number; hasMore: boolean };

type ListingPayload = {
  cards?: PromptCardFull[];
  ranked_batch_size?: number;
  total_count?: number;
  has_more?: boolean;
};

function chipKey(chip: HomepageExplorerChip): string {
  return `${chip.dimension}:${chip.slug}`;
}

function LoadMoreChevron() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

async function fetchFeedPage(
  feed: HomeFeedQuery,
  offset: number,
  limit: number,
  signal?: AbortSignal,
): Promise<{ cards: GenerationExampleCard[]; nextOffset: number; hasMore: boolean }> {
  const response = await fetch(homeFeedUrl(feed, offset, limit), {
    cache: feed.q ? "default" : "no-store",
    signal,
  });
  if (!response.ok) throw new Error("listing_request_failed");
  const payload = (await response.json()) as ListingPayload;
  const cards = (payload.cards ?? []).map(toGenerationExampleCard);
  return {
    cards,
    ...readHomeFeedPage({
      feed,
      offset,
      limit,
      receivedCards: cards.length,
      rankedBatchSize: payload.ranked_batch_size,
      totalCount: payload.total_count,
      hasMore: payload.has_more,
    }),
  };
}

export function HomepageExamplesExplorer({
  initialCards,
  initialRankedCount,
  initialTotalCount,
}: {
  initialCards: GenerationExampleCard[];
  initialRankedCount: number;
  initialTotalCount: number;
}) {
  const pinnedChips = useMemo(() => getPinnedChips(), []);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<HomepageExplorerChip | null>(
    null
  );
  const [cardPages, setCardPages] = useState<GenerationExampleCard[][]>(() => [
    initialCards,
  ]);
  const cards = useMemo(() => cardPages.flat(), [cardPages]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const initialCursor = useMemo<FeedCursor>(
    () => ({
      feed: HOME_ALL_FEED,
      offset: initialRankedCount,
      hasMore: hasMoreListingFromOffset(initialRankedCount, initialTotalCount),
    }),
    [initialRankedCount, initialTotalCount],
  );
  const [hasMore, setHasMore] = useState(initialCursor.hasMore);
  const cursorRef = useRef<FeedCursor>(initialCursor);
  const loadingMoreRef = useRef(false);
  const hiddenIdsRef = useRef(new Set<string>());

  const setCursor = useCallback((next: FeedCursor) => {
    cursorRef.current = next;
    setHasMore(next.hasMore);
  }, []);

  useEffect(() => {
    if (cards.length > 0) writeGenerationExampleNavigation(cards);
  }, [cards]);

  useDebugCardHidden(
    useCallback((detail) => {
      hiddenIdsRef.current.add(detail.cardId);
      setCardPages((pages) => omitCardFromPages(pages, detail.cardId));
    }, []),
  );

  const setSearchQuery = useCallback((nextQuery: string) => {
    setQuery(nextQuery);
    if (nextQuery.trim()) setActiveFilter(null);
  }, []);

  const clearSearchQuery = useCallback(() => {
    setQuery("");
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    setRevealed(false);
    setLoadMoreError(false);
    if (trimmed.length < 2 && !activeFilter) {
      setCardPages([omitHiddenCardIds(initialCards, hiddenIdsRef.current)]);
      setCursor(initialCursor);
      setLoading(false);
      setError("");
      return;
    }
    if (trimmed.length > 0 && trimmed.length < 2) return;

    const feed = homeFeedQuery(trimmed, activeFilter);
    cursorRef.current = { feed, offset: 0, hasMore: false };
    const controller = new AbortController();
    const timer = window.setTimeout(
      () => {
        setLoading(true);
        setError("");
        void fetchFeedPage(feed, 0, RESULT_LIMIT, controller.signal)
          .then((page) => {
            setCardPages([omitHiddenCardIds(page.cards, hiddenIdsRef.current)]);
            setCursor({ feed, offset: page.nextOffset, hasMore: page.hasMore });
          })
          .catch((fetchError: unknown) => {
            if (
              fetchError instanceof DOMException &&
              fetchError.name === "AbortError"
            ) {
              return;
            }
            setCardPages([]);
            setCursor({ feed, offset: 0, hasMore: false });
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
  }, [activeFilter, initialCards, initialCursor, query, setCursor]);

  const loadMore = useCallback(async () => {
    const cursor = cursorRef.current;
    if (loadingMoreRef.current || !cursor.hasMore) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(false);
    setRevealed(true);
    try {
      const page = await fetchFeedPage(
        cursor.feed,
        cursor.offset,
        LISTING_INFINITE_PAGE_SIZE,
      );
      if (cursorRef.current !== cursor) return;
      setCardPages((pages) =>
        appendUniqueCardPage(pages, omitHiddenCardIds(page.cards, hiddenIdsRef.current)),
      );
      setCursor({ feed: cursor.feed, offset: page.nextOffset, hasMore: page.hasMore });
    } catch {
      if (cursorRef.current === cursor) setLoadMoreError(true);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [setCursor]);

  const selectChip = (chip: HomepageExplorerChip | null) => {
    setQuery("");
    setActiveFilter((current) =>
      chip && current && chipKey(current) === chipKey(chip) ? null : chip
    );
  };

  const showTeaser = hasMore && !revealed && !loading && cards.length > 0;
  const showMoreBelow = hasMore && revealed;
  const loadMoreText = loadingMore ? "Загружаем…" : LISTING_LOAD_MORE_LABEL;

  return (
    <section
      id="primery"
      className={`scroll-mt-20 ${GF_BLOCK_FLUSH} ${
        showTeaser ? "" : "pb-5 sm:pb-7"
      }`}
    >
      <ListingExplorerHeading
        title={HOMEPAGE_SEO.galleryTitle}
        titleAs="h2"
        titleId="examples-heading"
        intro={HOMEPAGE_SEO.galleryIntro}
      />

      <ListingExplorerSearch
        id="homepage-examples-search"
        value={query}
        onChange={setSearchQuery}
        onClear={clearSearchQuery}
        loading={loading}
      />

      <nav
        className="mt-4 flex flex-wrap gap-2"
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
              aria-current={active ? "true" : undefined}
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

      <div className={`relative mt-5${showTeaser ? " overflow-hidden" : ""}`}>
        <ListingMasonry
          loading={loading}
          entries={cards.map((card, index) => {
            const aspectRatio = listingPhotoAspectRatio(
              card.photoWidth,
              card.photoHeight,
              index
            );
            return {
              key: card.id,
              aspectRatio,
              content: <ListingPhotoTile card={card} aspectRatio={aspectRatio} />,
            };
          })}
        />

        {showTeaser ? (
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
                disabled={loadingMore}
                onClick={() => void loadMore()}
                className={`pointer-events-auto ${LOAD_MORE_BUTTON}`}
              >
                {loadMoreText}
                <LoadMoreChevron />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {showMoreBelow ? (
        <div className="mt-5 flex flex-col items-center gap-3">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void loadMore()}
            className={LOAD_MORE_BUTTON}
          >
            {loadMoreText}
            <LoadMoreChevron />
          </button>
        </div>
      ) : null}

      {loadMoreError ? (
        <p className="mt-3 text-center text-sm text-rose-600" role="status">
          Не удалось загрузить карточки. Попробуйте ещё раз.
        </p>
      ) : null}

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
    </section>
  );
}
