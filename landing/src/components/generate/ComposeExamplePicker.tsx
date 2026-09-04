"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type GenerationExampleCard,
  toGenerationExampleCard,
} from "@/lib/generation/example-card";
import {
  GENERACIYA_FOTO_SCENARIOS,
} from "@/lib/generaciya-foto-seo-copy";
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
  peekComposeExampleAudience,
  prefetchComposeExampleAudience,
  readComposeExampleAudience,
} from "@/lib/compose-example-audience-client";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import type { PromptCardFull } from "@/lib/supabase";
import { selectedPromptText } from "@/lib/photoshoot";

const SEARCH_DEBOUNCE_MS = 200;

type QuickFilter = ReturnType<typeof composeExampleQuickFilters>[number];

const QUICK_FILTERS = composeExampleQuickFilters(GENERACIYA_FOTO_SCENARIOS);

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
  /** Dock photos sheet uses dark glass; card modal uses light. */
  tone?: "light" | "dark";
  confirmCtaClassName: string;
  matchEnabled?: boolean;
  matchPhoto?: ComposeExampleMatchPhoto | null;
};

type ListingPagePayload = {
  cards?: PromptCardFull[];
  ranked_batch_size?: number;
  total_count?: number;
  has_more?: boolean;
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

export function ComposeExamplePicker({
  selectedCardId,
  onSelect,
  onConfirmed,
  tone = "dark",
  confirmCtaClassName,
  matchEnabled = false,
  matchPhoto = null,
}: ComposeExamplePickerProps) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<QuickFilter | null>(null);
  const [audienceMatch, setAudienceMatch] = useState<ComposeExampleAudienceTag | null>(
    () => readComposeExampleAudience(matchPhoto, matchEnabled),
  );
  const [audienceDismissed, setAudienceDismissed] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(
    selectedCardId,
  );
  const [cards, setCards] = useState<GenerationExampleCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onConfirmedRef = useRef(onConfirmed);
  onConfirmedRef.current = onConfirmed;
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
    ? "border-white/15 bg-white/10 text-white focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-400/25"
    : "border-zinc-200 bg-zinc-50 text-zinc-900 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/20";
  const chipIdle = dark
    ? "border-white/20 bg-white/10 text-white/80 hover:bg-white/15"
    : "border-zinc-200 bg-white text-zinc-600 hover:border-indigo-200 hover:text-indigo-700";
  const chipActive = dark
    ? "border-indigo-300 bg-indigo-500/30 text-white"
    : "border-indigo-500 bg-indigo-500 text-white";

  const mapListingCards = useCallback(
    (raw: PromptCardFull[]): GenerationExampleCard[] => {
      let next = filterComposeExampleCards(
        raw.map(toGenerationExampleCard),
        "photo",
      );
      if (query.trim().length < 2 && activeFilter) {
        next = next.filter((card) => matchesQuickFilter(card, activeFilter));
      }
      return next;
    },
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
      const response = await fetch(endpoint, { cache: "default", signal });
      if (!response.ok) throw new Error("search_failed");
      const payload = (await response.json()) as ListingPagePayload;
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

  useEffect(() => {
    fetchGenRef.current += 1;
    setHasMore(false);
    setLoadingMore(false);
    setNextOffset(0);

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

    const controller = new AbortController();
    const gen = fetchGenRef.current;
    const timer = window.setTimeout(
      () => {
        setLoading(cardsLenRef.current === 0);
        setError("");
        void (async () => {
          try {
            let collected: GenerationExampleCard[] = [];
            let offset = 0;
            let more = false;
            const page = await readPage(offset, controller.signal);
            if (!page || fetchGenRef.current !== gen) return;
            collected = mergeUniqueCards(collected, page.cards);
            offset = page.nextOffset;
            more = page.hasMore;
            if (fetchGenRef.current !== gen) return;
            setCards(collected);
            setNextOffset(offset);
            setHasMore(more);
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
  }, [activeFilter, query, readPage]);

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
      { root, rootMargin: "80px" },
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
      <div className="-mx-0.5 flex shrink-0 gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {listingAudience ? (
          <button
            type="button"
            onClick={() => setAudienceDismissed(true)}
            className={`${OVERLAY_BUTTON_UA_RESET} inline-flex shrink-0 min-h-11 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition ${chipActive}`}
            aria-pressed="true"
            aria-label={`${composeExampleAudienceChipLabel(listingAudience)}. ${COMPOSE_EXAMPLE_MATCH_CHIP_DISMISS_LABEL}`}
          >
            {composeExampleAudienceChipLabel(listingAudience)}
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
        {QUICK_FILTERS.map((filter) => {
          const active =
            activeFilter?.dimension === filter.dimension &&
            activeFilter.value === filter.value;
          return (
            <button
              key={`${filter.dimension}-${filter.value}`}
              type="button"
              onClick={() => {
                setActiveFilter(active ? null : filter);
                setQuery("");
              }}
              className={`${OVERLAY_BUTTON_UA_RESET} inline-flex shrink-0 min-h-11 items-center rounded-full border px-3 text-[13px] font-semibold transition ${active ? chipActive : chipIdle}`}
            >
              {filter.label}
            </button>
          );
        })}
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
                    onClick={() => setHighlightedId(card.id)}
                    className={`${OVERLAY_BUTTON_UA_RESET} relative aspect-[3/4] w-full rounded-xl after:pointer-events-none after:absolute after:inset-0 after:z-[1] after:rounded-xl after:border-2 after:border-solid transition ${
                      highlighted
                        ? "after:border-indigo-400"
                        : dark
                          ? "after:border-white/15 hover:after:border-indigo-300/70"
                          : "after:border-zinc-200 hover:after:border-indigo-300"
                    } ${picking ? "opacity-60" : ""}`}
                  >
                    <span className="absolute inset-0 overflow-hidden rounded-xl">
                      {card.photoUrl ? (
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
                        className="absolute right-1.5 top-1.5 z-[2] flex h-6 w-6 items-center justify-center rounded-full bg-indigo-300 text-[13px] font-bold text-zinc-950 shadow"
                      >
                        ✓
                      </span>
                    ) : null}
                    {picking ? (
                      <span className="absolute inset-0 z-[2] flex items-center justify-center rounded-xl bg-black/35 text-[13px] font-semibold text-white">
                        …
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
            {hasMore ? (
              <li
                ref={sentinelRef}
                className="col-span-full h-8"
                aria-hidden
              />
            ) : null}
          </ul>
        ) : loading ? (
          <p className={`text-[13px] ${dark ? "text-white/55" : "text-zinc-500"}`}>
            Ищем образы…
          </p>
        ) : (
          <p className={`text-[13px] ${dark ? "text-white/55" : "text-zinc-500"}`}>
            {emptyHint}
          </p>
        )}
      </div>
      <button
        type="button"
        disabled={!highlightedId || Boolean(pickingId)}
        onClick={() => void confirmHighlighted()}
        className={`${confirmCtaClassName} disabled:opacity-50`}
      >
        {pickingId ? "…" : SEO_COMPOSE_EXAMPLE_CONFIRM_CTA}
      </button>
    </div>
  );
}
