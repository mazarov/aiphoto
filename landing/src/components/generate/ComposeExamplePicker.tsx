"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ListingCardVideo } from "@/components/ListingCardVideo";
import {
  type GenerationExampleCard,
  toGenerationExampleCard,
} from "@/lib/generation/example-card";
import { GENERACIYA_FOTO_SCENARIOS } from "@/lib/generaciya-foto-seo-copy";
import {
  SEO_COMPOSE_EXAMPLE_CONFIRM_CTA,
  SEO_COMPOSE_EXAMPLE_LIMIT,
  SEO_COMPOSE_EXAMPLE_SEARCH_ID,
  SEO_COMPOSE_EXAMPLE_SEARCH_PLACEHOLDER,
  composeExamplePickerEndpoint,
  composeExamplePickerHasMore,
  composeExamplePickerLimit,
  composeExamplePickerListingAudience,
  composeExampleQuickFilters,
  filterComposeExampleCards,
} from "@/lib/generaciya-foto-compose-example";
import {
  COMPOSE_EXAMPLE_MATCH_CHIP_DISMISS_LABEL,
  composeExampleAudienceChipLabel,
  type ComposeExampleAudienceTag,
} from "@/lib/compose-example-audience";
import {
  composeExampleMatchPhotoKey,
  loadComposeExampleListing,
  peekComposeExampleAudience,
  peekComposeExampleListing,
  prefetchComposeExampleAudience,
  readComposeExampleAudience,
} from "@/lib/compose-example-audience-client";
import {
  OVERLAY_BUTTON_APPEARANCE_RESET,
  OVERLAY_BUTTON_UA_RESET,
} from "@/lib/card-overlay-action-pill";
import type { PromptCardFull } from "@/lib/supabase";
import { selectedPromptText } from "@/lib/photoshoot";
import { listingComposeExampleInitialFilter } from "@/lib/generate-dock-path";

const SEARCH_DEBOUNCE_MS = 200;
const PAGING_SKELETON_COUNT = 4;

type QuickFilter = ReturnType<typeof composeExampleQuickFilters>[number];

const QUICK_FILTERS = composeExampleQuickFilters(GENERACIYA_FOTO_SCENARIOS);

function quickFilterFromListingPath(pathname: string): QuickFilter | null {
  const seed = listingComposeExampleInitialFilter(pathname);
  if (!seed) return null;
  return (
    QUICK_FILTERS.find(
      (filter) =>
        filter.dimension === seed.dimension && filter.value === seed.value,
    ) ?? null
  );
}

export type ComposeExampleMatchPhoto = {
  id: string;
  dataUrl?: string | null;
  audienceTag?: string | null;
};

type ComposeExamplePickerProps = {
  selectedCardId: string | null;
  onSelect: (input: {
    cardId: string;
    slug: string;
    title: string;
    photoUrl: string | null;
    promptText: string;
  }) => void;
  /** Called after a successful pick so the parent can close the sheet. */
  onConfirmed?: () => void;
  /**
   * When true (in-flow dock drawer), tapping a card immediately applies its style & prompt
   * and omits the redundant bottom «Выбрать» button.
   */
  instantSelect?: boolean;
  /** Dock photos sheet uses dark glass; card modal uses light. */
  tone?: "light" | "dark";
  confirmCtaClassName: string;
  matchEnabled?: boolean;
  matchPhoto?: ComposeExampleMatchPhoto | null;
};

function matchesQuickFilter(card: GenerationExampleCard, filter: QuickFilter): boolean {
  return (card.seoTags[filter.dimension] || []).includes(filter.value);
}

function promptFromExampleCard(card: GenerationExampleCard): string {
  return selectedPromptText({
    promptTexts: card.navigationData.promptTexts ?? [],
    photoCount: card.photoCount,
    photoIndex: 0,
  }).trim();
}

function SearchGlyph() {
  return (
    <svg
      className="h-5 w-5 shrink-0 opacity-55"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function mergeUniqueCards(
  current: GenerationExampleCard[],
  incoming: GenerationExampleCard[],
): GenerationExampleCard[] {
  if (current.length === 0) return incoming;
  const seen = new Set(current.map((card) => card.id));
  const next = current.slice();
  for (const card of incoming) {
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    next.push(card);
  }
  return next;
}

function hydrateExampleCards(
  raw: PromptCardFull[] | undefined,
  query: string,
  activeFilter: QuickFilter | null,
): GenerationExampleCard[] {
  let next = filterComposeExampleCards(
    (raw ?? []).map(toGenerationExampleCard),
    "photo",
  );
  if (query.trim().length < 2 && activeFilter) {
    next = next.filter((card) => matchesQuickFilter(card, activeFilter));
  }
  return next;
}

function peekPickerFirstPage(
  pathname: string,
  matchPhoto: ComposeExampleMatchPhoto | null,
  matchEnabled: boolean,
) {
  const filter = quickFilterFromListingPath(pathname);
  const audience = readComposeExampleAudience(matchPhoto, matchEnabled);
  const url = composeExamplePickerEndpoint({
    query: "",
    filter: filter
      ? { dimension: filter.dimension, value: filter.value }
      : null,
    audienceMatch: audience,
  });
  const page = url ? peekComposeExampleListing(url) : undefined;
  return { filter, url, page };
}

export function ComposeExamplePicker({
  selectedCardId,
  onSelect,
  onConfirmed,
  instantSelect = false,
  tone = "dark",
  confirmCtaClassName,
  matchEnabled = false,
  matchPhoto = null,
}: ComposeExamplePickerProps) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<QuickFilter | null>(() =>
    quickFilterFromListingPath(pathname),
  );
  const [audienceMatch, setAudienceMatch] = useState<ComposeExampleAudienceTag | null>(
    () => readComposeExampleAudience(matchPhoto, matchEnabled),
  );
  const [audienceDismissed, setAudienceDismissed] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(
    selectedCardId,
  );
  const [cards, setCards] = useState<GenerationExampleCard[]>(() => {
    const peeked = peekPickerFirstPage(pathname, matchPhoto, matchEnabled);
    return hydrateExampleCards(peeked.page?.cards, "", peeked.filter);
  });
  const [loading, setLoading] = useState(() => {
    const peeked = peekPickerFirstPage(pathname, matchPhoto, matchEnabled);
    return Boolean(peeked.url) && !peeked.page;
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [chipsScrollState, setChipsScrollState] = useState({
    canLeft: false,
    canRight: false,
  });

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onConfirmedRef = useRef(onConfirmed);
  onConfirmedRef.current = onConfirmed;
  const chipsScrollRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLLIElement>(null);
  const loadMoreRef = useRef<() => void>(() => {});
  const fetchGenRef = useRef(0);
  const cardsLenRef = useRef(0);
  cardsLenRef.current = cards.length;

  const matchKey = matchPhoto ? composeExampleMatchPhotoKey(matchPhoto) : "";
  const matchPhotoRef = useRef(matchPhoto);
  matchPhotoRef.current = matchPhoto;
  const listingAudience = composeExamplePickerListingAudience({
    query,
    dismissed: audienceDismissed,
    audienceMatch,
  });

  const syncChipsScrollState = useCallback(() => {
    const el = chipsScrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const canLeft = el.scrollLeft > 4;
    const canRight = maxScroll - el.scrollLeft > 4;
    setChipsScrollState((prev) =>
      prev.canLeft === canLeft && prev.canRight === canRight
        ? prev
        : { canLeft, canRight },
    );
  }, []);

  useEffect(() => {
    const el = chipsScrollRef.current;
    if (!el) return;
    syncChipsScrollState();
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => syncChipsScrollState())
        : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [listingAudience, syncChipsScrollState]);

  const scrollChipsBy = (direction: -1 | 1) => {
    const el = chipsScrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction * Math.max(180, Math.round(el.clientWidth * 0.65)),
      behavior: "smooth",
    });
  };

  useEffect(() => {
    setAudienceDismissed(false);
  }, [matchKey]);

  useEffect(() => {
    const photo = matchPhotoRef.current;
    if (!matchEnabled || !photo) {
      setAudienceMatch(null);
      return;
    }
    const ready = peekComposeExampleAudience(photo);
    if (ready !== undefined) {
      setAudienceMatch(ready);
      return;
    }
    let cancelled = false;
    void prefetchComposeExampleAudience(photo).then((tag) => {
      if (!cancelled) setAudienceMatch(tag);
    });
    return () => {
      cancelled = true;
    };
  }, [matchEnabled, matchKey, matchPhoto?.audienceTag]);

  const dark = tone === "dark";
  const shellClass = dark
    ? "border-white/15 bg-black/25 text-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.28)] focus-within:border-indigo-300 focus-within:bg-black/35 focus-within:ring-2 focus-within:ring-indigo-400/25"
    : "border-zinc-200 bg-zinc-50 text-zinc-900 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/20";
  const chipIdle = dark
    ? "border-white/15 bg-black/20 text-white/85 hover:border-white/30 hover:bg-white/10"
    : "border-zinc-200 bg-white text-zinc-700 hover:border-indigo-200 hover:text-indigo-700";
  const chipActive = dark
    ? "border-indigo-300/90 bg-indigo-500/45 text-white shadow-sm"
    : "border-indigo-500 bg-indigo-500 text-white shadow-sm";

  const mapListingCards = useCallback(
    (raw: PromptCardFull[]): GenerationExampleCard[] =>
      hydrateExampleCards(raw, query, activeFilter),
    [activeFilter, query],
  );

  const readPage = useCallback(
    async (offset: number, signal: AbortSignal) => {
      const endpoint = composeExamplePickerEndpoint({
        query,
        filter: activeFilter
          ? { dimension: activeFilter.dimension, value: activeFilter.value }
          : null,
        audienceMatch: listingAudience,
        offset,
      });
      if (!endpoint) return null;
      if (signal.aborted) return null;
      const payload = await loadComposeExampleListing(endpoint);
      if (signal.aborted) return null;
      if (!payload) throw new Error("search_failed");
      const raw = payload.cards ?? [];
      const requestedLimit = composeExamplePickerLimit("photo");
      const rankedBatchSize = payload.ranked_batch_size ?? raw.length;
      const more = composeExamplePickerHasMore({
        isSearch: query.trim().length >= 2,
        offset,
        rankedBatchSize,
        receivedCount: raw.length,
        requestedLimit,
        totalCount: payload.total_count ?? 0,
        searchHasMore: payload.has_more,
      });
      return {
        cards: mapListingCards(raw),
        nextOffset: offset + (rankedBatchSize > 0 ? rankedBatchSize : raw.length),
        hasMore: more,
      };
    },
    [activeFilter, listingAudience, mapListingCards, query],
  );

  const scrollGridToTop = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = 0;
  }, []);

  useEffect(() => {
    fetchGenRef.current += 1;
    setHasMore(false);
    setLoadingMore(false);
    setNextOffset(0);
    scrollGridToTop();

    const endpoint = composeExamplePickerEndpoint({
      query,
      filter: activeFilter
        ? { dimension: activeFilter.dimension, value: activeFilter.value }
        : null,
      audienceMatch: listingAudience,
    });
    if (!endpoint) {
      setCards([]);
      setLoading(false);
      setError("");
      return;
    }

    const cached = peekComposeExampleListing(endpoint);
    if (cached && query.trim().length < 2) {
      const mapped = mapListingCards(cached.cards ?? []);
      const requestedLimit = composeExamplePickerLimit("photo");
      const rankedBatchSize = cached.ranked_batch_size ?? (cached.cards ?? []).length;
      setCards(mapped);
      setNextOffset(
        rankedBatchSize > 0 ? rankedBatchSize : (cached.cards ?? []).length,
      );
      setHasMore(
        composeExamplePickerHasMore({
          isSearch: false,
          offset: 0,
          rankedBatchSize,
          receivedCount: (cached.cards ?? []).length,
          requestedLimit,
          totalCount: cached.total_count ?? 0,
          searchHasMore: cached.has_more,
        }),
      );
      setLoading(false);
      setError("");
      window.requestAnimationFrame(scrollGridToTop);
      return;
    }

    const controller = new AbortController();
    const gen = fetchGenRef.current;
    const timer = window.setTimeout(
      () => {
        setLoading(true);
        if (query.trim().length < 2) {
          setCards([]);
        }
        setError("");
        void (async () => {
          try {
            const page = await readPage(0, controller.signal);
            if (!page || fetchGenRef.current !== gen) return;
            setCards(page.cards);
            setNextOffset(page.nextOffset);
            setHasMore(page.hasMore);
            window.requestAnimationFrame(scrollGridToTop);
          } catch (fetchError: unknown) {
            if (
              fetchError instanceof DOMException &&
              fetchError.name === "AbortError"
            ) {
              return;
            }
            if (fetchGenRef.current !== gen) return;
            setCards([]);
            setHasMore(false);
            setNextOffset(0);
            setError("Не удалось загрузить образы. Попробуйте ещё раз.");
          } finally {
            if (!controller.signal.aborted && fetchGenRef.current === gen) {
              setLoading(false);
              setLoadingMore(false);
            }
          }
        })();
      },
      query.trim().length >= 2 ? SEARCH_DEBOUNCE_MS : 0,
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    activeFilter,
    listingAudience,
    mapListingCards,
    query,
    readPage,
    scrollGridToTop,
  ]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    const gen = fetchGenRef.current;
    const offset = nextOffset;
    setLoadingMore(true);
    void readPage(offset, new AbortController().signal)
      .then((page) => {
        if (!page || fetchGenRef.current !== gen) return;
        setCards((current) => mergeUniqueCards(current, page.cards));
        setNextOffset(page.nextOffset);
        setHasMore(page.hasMore);
      })
      .catch((fetchError: unknown) => {
        if (
          fetchError instanceof DOMException &&
          fetchError.name === "AbortError"
        ) {
          return;
        }
      })
      .finally(() => {
        if (fetchGenRef.current === gen) setLoadingMore(false);
      });
  }, [hasMore, loading, loadingMore, nextOffset, readPage]);
  loadMoreRef.current = loadMore;

  useEffect(() => {
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!root || !target || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMoreRef.current();
        }
      },
      { root, rootMargin: "240px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [cards.length, hasMore]);

  useEffect(() => {
    setHighlightedId(selectedCardId);
  }, [selectedCardId]);

  const pickCard = async (card: GenerationExampleCard): Promise<boolean> => {
    if (pickingId) return false;
    setPickingId(card.id);
    setError("");
    try {
      let promptText = promptFromExampleCard(card);
      if (promptText.length < 8) {
        const res = await fetch(`/api/card/${encodeURIComponent(card.slug)}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("card_failed");
        const payload = (await res.json()) as {
          data?: {
            id: string;
            slug: string;
            promptTexts?: string[];
            photoUrls?: string[];
          };
        };
        const data = payload.data;
        if (!data?.id) throw new Error("card_missing");
        promptText = selectedPromptText({
          promptTexts: data.promptTexts ?? [],
          photoCount: data.photoUrls?.length ?? card.photoCount,
          photoIndex: 0,
        }).trim();
      }
      if (promptText.length < 8) throw new Error("prompt_short");
      onSelectRef.current({
        cardId: card.id,
        slug: card.slug,
        title: card.title,
        photoUrl: card.photoUrl,
        promptText,
      });
      return true;
    } catch {
      setError("Не удалось открыть образ. Выберите другой.");
      return false;
    } finally {
      setPickingId(null);
    }
  };

  const confirmHighlighted = async () => {
    if (!highlightedId || pickingId) return;
    if (highlightedId === selectedCardId) {
      onConfirmedRef.current?.();
      return;
    }
    const card = cards.find((item) => item.id === highlightedId);
    if (!card) {
      setError("Выберите кадр из списка.");
      return;
    }
    const ok = await pickCard(card);
    if (ok) onConfirmedRef.current?.();
  };

  const emptyHint =
    query.trim().length >= 2 || activeFilter || listingAudience
      ? "Ничего не нашли — попробуйте другой запрос или тему."
      : "Каталог образов сейчас пуст. Введите запрос.";

  const chipsMaskStyle =
    chipsScrollState.canLeft && chipsScrollState.canRight
      ? {
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0px, black 20px, black calc(100% - 24px), transparent 100%)",
          maskImage:
            "linear-gradient(to right, transparent 0px, black 20px, black calc(100% - 24px), transparent 100%)",
        }
      : chipsScrollState.canRight
        ? {
            WebkitMaskImage:
              "linear-gradient(to right, black 0px, black calc(100% - 24px), transparent 100%)",
            maskImage:
              "linear-gradient(to right, black 0px, black calc(100% - 24px), transparent 100%)",
          }
        : chipsScrollState.canLeft
          ? {
              WebkitMaskImage:
                "linear-gradient(to right, transparent 0px, black 20px, black 100%)",
              maskImage:
                "linear-gradient(to right, transparent 0px, black 20px, black 100%)",
            }
          : undefined;

  const skeletonTileClass = dark
    ? "aspect-[3/4] w-full animate-pulse rounded-xl bg-white/10 ring-1 ring-inset ring-white/10"
    : "aspect-[3/4] w-full animate-pulse rounded-xl bg-zinc-200/80 ring-1 ring-inset ring-zinc-200";

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden">
      <div
        className={`flex min-h-11 shrink-0 items-center gap-2.5 rounded-2xl border px-3 ${shellClass}`}
      >
        <SearchGlyph />
        <label htmlFor={SEO_COMPOSE_EXAMPLE_SEARCH_ID} className="sr-only">
          {SEO_COMPOSE_EXAMPLE_SEARCH_PLACEHOLDER}
        </label>
        <input
          id={SEO_COMPOSE_EXAMPLE_SEARCH_ID}
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveFilter(null);
          }}
          placeholder={SEO_COMPOSE_EXAMPLE_SEARCH_PLACEHOLDER}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-[13px] font-medium outline-none placeholder:opacity-55"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="search"
          inputMode="search"
        />
        {loading ? (
          <span
            className={`h-5 w-5 shrink-0 animate-spin rounded-full border-2 ${
              dark
                ? "border-white/20 border-t-white"
                : "border-indigo-100 border-t-indigo-500"
            }`}
            aria-label="Ищем"
          />
        ) : query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className={`${OVERLAY_BUTTON_UA_RESET} flex h-8 w-8 shrink-0 items-center justify-center rounded-full opacity-70 transition hover:opacity-100`}
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

      <div className="relative flex shrink-0 items-center">
        {chipsScrollState.canLeft ? (
          <button
            type="button"
            aria-label="Прокрутить категории влево"
            onClick={() => scrollChipsBy(-1)}
            className={`${OVERLAY_BUTTON_UA_RESET} absolute left-0 z-10 hidden h-8 w-8 items-center justify-center rounded-full shadow-md backdrop-blur-md transition sm:flex ${
              dark
                ? "bg-zinc-900/85 text-white ring-1 ring-white/20 hover:bg-zinc-800"
                : "bg-white/95 text-zinc-800 ring-1 ring-zinc-200 hover:bg-zinc-50"
            }`}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : null}

        <div
          ref={chipsScrollRef}
          onScroll={syncChipsScrollState}
          style={chipsMaskStyle}
          className="flex w-full gap-2 overflow-x-auto overscroll-x-contain px-1 py-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <button
            type="button"
            aria-pressed={activeFilter === null && !query.trim()}
            onClick={(event) => {
              scrollGridToTop();
              setActiveFilter(null);
              setQuery("");
              event.currentTarget.scrollIntoView({
                block: "nearest",
                inline: "nearest",
                behavior: "smooth",
              });
            }}
            className={`${OVERLAY_BUTTON_APPEARANCE_RESET} inline-flex min-h-9 shrink-0 items-center rounded-full border px-3.5 text-[13px] font-semibold leading-none transition ${
              activeFilter === null && !query.trim() ? chipActive : chipIdle
            }`}
          >
            Новые
          </button>

          {listingAudience ? (
            <button
              type="button"
              onClick={() => {
                scrollGridToTop();
                setAudienceDismissed(true);
              }}
              className={`${OVERLAY_BUTTON_APPEARANCE_RESET} inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold leading-none transition ${chipActive}`}
              aria-pressed="true"
              aria-label={`${composeExampleAudienceChipLabel(listingAudience)}. ${COMPOSE_EXAMPLE_MATCH_CHIP_DISMISS_LABEL}`}
            >
              {composeExampleAudienceChipLabel(listingAudience)}
              <svg
                className="h-3.5 w-3.5"
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

          {QUICK_FILTERS.map((filter) => {
            const active =
              activeFilter?.dimension === filter.dimension &&
              activeFilter.value === filter.value;
            return (
              <button
                key={`${filter.dimension}-${filter.value}`}
                type="button"
                aria-pressed={active}
                onClick={(event) => {
                  scrollGridToTop();
                  setActiveFilter(active ? null : filter);
                  setQuery("");
                  event.currentTarget.scrollIntoView({
                    block: "nearest",
                    inline: "center",
                    behavior: "smooth",
                  });
                }}
                className={`${OVERLAY_BUTTON_APPEARANCE_RESET} inline-flex min-h-9 shrink-0 items-center rounded-full border px-3.5 text-[13px] font-semibold leading-none transition ${
                  active ? chipActive : chipIdle
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        {chipsScrollState.canRight ? (
          <button
            type="button"
            aria-label="Прокрутить категории вправо"
            onClick={() => scrollChipsBy(1)}
            className={`${OVERLAY_BUTTON_UA_RESET} absolute right-0 z-10 hidden h-8 w-8 items-center justify-center rounded-full shadow-md backdrop-blur-md transition sm:flex ${
              dark
                ? "bg-zinc-900/85 text-white ring-1 ring-white/20 hover:bg-zinc-800"
                : "bg-white/95 text-zinc-800 ring-1 ring-zinc-200 hover:bg-zinc-50"
            }`}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : null}
      </div>

      {error ? (
        <p className={`shrink-0 text-[13px] ${dark ? "text-rose-300" : "text-rose-600"}`} role="status">
          {error}
        </p>
      ) : null}

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
      >
        {cards.length > 0 ? (
          <ul className="grid auto-rows-min grid-cols-3 content-start gap-2 p-0.5 sm:grid-cols-4">
            {cards.map((card, index) => {
              const highlighted = highlightedId === card.id;
              const picking = pickingId === card.id;
              return (
                <li key={card.id}>
                  <button
                    type="button"
                    disabled={Boolean(pickingId)}
                    aria-pressed={highlighted}
                    aria-label={card.title}
                    onClick={() => {
                      setHighlightedId(card.id);
                      if (instantSelect) {
                        void pickCard(card);
                      }
                    }}
                    className={`${OVERLAY_BUTTON_UA_RESET} relative aspect-[3/4] w-full rounded-xl after:pointer-events-none after:absolute after:inset-0 after:z-[3] after:rounded-xl after:border-2 after:border-solid transition ${
                      highlighted
                        ? "after:border-indigo-400"
                        : dark
                          ? "after:border-white/15 hover:after:border-indigo-300/70"
                          : "after:border-zinc-200 hover:after:border-indigo-300"
                    } ${picking ? "opacity-60" : ""}`}
                  >
                    <span
                      className={`absolute inset-0 overflow-hidden rounded-xl ${
                        dark ? "bg-zinc-900" : "bg-zinc-100"
                      }`}
                    >
                      {card.videoUrl ? (
                        <>
                          <ListingCardVideo
                            src={card.videoUrl}
                            poster={card.photoUrl}
                          />
                          <span
                            aria-hidden
                            className="pointer-events-none absolute left-1.5 top-1.5 z-[3] inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm"
                          >
                            <svg className="ml-0.5 h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M8 6.5v11l9-5.5Z" />
                            </svg>
                          </span>
                        </>
                      ) : card.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={card.photoUrl}
                          alt=""
                          loading={index < SEO_COMPOSE_EXAMPLE_LIMIT ? "eager" : "lazy"}
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span
                          className={`block h-full w-full ${
                            dark ? "bg-zinc-800" : "bg-zinc-100"
                          }`}
                        />
                      )}
                    </span>
                    {highlighted ? (
                      <span
                        aria-hidden
                        className="absolute right-1.5 top-1.5 z-[4] flex h-6 w-6 items-center justify-center rounded-full bg-indigo-300 text-[13px] font-bold text-zinc-950 shadow"
                      >
                        ✓
                      </span>
                    ) : null}
                    {picking ? (
                      <span className="absolute inset-0 z-[4] flex items-center justify-center rounded-xl bg-black/35 text-[13px] font-semibold text-white">
                        …
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}

            {loadingMore
              ? Array.from({ length: PAGING_SKELETON_COUNT }).map((_, index) => (
                  <li key={`paging-skeleton-${index}`} aria-hidden>
                    <div className={skeletonTileClass} />
                  </li>
                ))
              : null}

            {hasMore ? (
              <li
                ref={sentinelRef}
                className="col-span-full flex items-center justify-center py-2.5"
              >
                {loadingMore ? (
                  <span
                    role="status"
                    aria-live="polite"
                    className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium ${
                      dark
                        ? "bg-white/10 text-white/80 ring-1 ring-white/15"
                        : "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200"
                    }`}
                  >
                    <span
                      className={`h-3.5 w-3.5 animate-spin rounded-full border-2 ${
                        dark
                          ? "border-white/25 border-t-white"
                          : "border-zinc-300 border-t-indigo-600"
                      }`}
                      aria-hidden
                    />
                    Подгружаем ещё…
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={loadMore}
                    className={`${OVERLAY_BUTTON_APPEARANCE_RESET} inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border px-4 text-[13px] font-semibold leading-none transition ${chipIdle}`}
                  >
                    Показать ещё
                  </button>
                )}
              </li>
            ) : null}
          </ul>
        ) : loading ? (
          <div
            className="grid auto-rows-min grid-cols-3 content-start gap-2 p-0.5 sm:grid-cols-4"
            aria-busy="true"
            aria-label="Загружаем образы"
          >
            {Array.from({ length: SEO_COMPOSE_EXAMPLE_LIMIT }).map((_, index) => (
              <div key={`init-skeleton-${index}`} className={skeletonTileClass} />
            ))}
          </div>
        ) : (
          <p className={`py-6 text-center text-[13px] ${dark ? "text-white/55" : "text-zinc-500"}`}>
            {emptyHint}
          </p>
        )}
      </div>

      {!instantSelect ? (
        <button
          type="button"
          disabled={!highlightedId || Boolean(pickingId)}
          onClick={() => void confirmHighlighted()}
          className={`${confirmCtaClassName} disabled:opacity-50`}
        >
          {pickingId ? "…" : SEO_COMPOSE_EXAMPLE_CONFIRM_CTA}
        </button>
      ) : null}
    </div>
  );
}
