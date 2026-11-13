/**
 * Сохраняет порядок slug карточек с листинга (localStorage) + runtime-контракт
 * пагинации активной ленты, чтобы из открытой карточки `/p/[slug]` при докликивании
 * или досвайпывании до конца списка автоматически подгружалась следующая порция
 * и открывалась следующая карточка.
 */

import type { CardPageData, PromptCardFull } from "@/lib/supabase";

export const LISTING_CARD_NAV_STORAGE_KEY = "promptshot_listing_nav_v1";
export const LISTING_CARD_NAV_UPDATED_EVENT =
  "promptshot:listing-navigation-updated";
export const LISTING_CARD_NAV_LOAD_MORE_EVENT =
  "promptshot:listing-navigation-load-more";
export const LISTING_CARD_NAV_LOAD_MORE_SETTLED_EVENT =
  "promptshot:listing-navigation-load-more-settled";

/** Верхний предел записи в localStorage — защита от раздувания. */
export const LISTING_CARD_NAV_MAX_SLUGS = 500;
const LISTING_CARD_DATA_CACHE_MAX = 600;

export type ListingNavGridItem =
  | { type: "single"; card: PromptCardFull }
  | { type: "group"; key: string; cards: PromptCardFull[] };

export type ListingNavigationWriteOptions = {
  sourceId?: string | null;
  hasMore?: boolean;
};

type StoredPayload = {
  slugs: string[];
  updatedAt: number;
};

type LoadMoreHandler = () => void | Promise<unknown>;

const listingCardDataBySlug = new Map<string, CardPageData>();
const loadMoreSubscribers = new Map<LoadMoreHandler, string | null>();

let activeNavigationSourceId: string | null = null;
let activeNavigationHasMore = false;
let activeNavigationLoading = false;
let inflightLoadMorePromise: Promise<void> | null = null;

function normalizeSlug(slug: string | null | undefined): string | null {
  const t = slug?.trim();
  return t || null;
}

function dispatchWindowEvent(eventName: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(eventName));
}

function waitNextCommitTurn(): Promise<void> {
  return new Promise((resolve) => {
    if (
      typeof window !== "undefined" &&
      typeof window.requestAnimationFrame === "function"
    ) {
      window.requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}

function getMatchingLoadMoreHandlers(): LoadMoreHandler[] {
  const handlers: LoadMoreHandler[] = [];
  for (const [handler, subSourceId] of loadMoreSubscribers.entries()) {
    if (activeNavigationSourceId !== null) {
      if (subSourceId === activeNavigationSourceId) {
        handlers.push(handler);
      }
    } else if (subSourceId === null) {
      handlers.push(handler);
    }
  }
  return handlers;
}

/**
 * DOM-порядок листинга: ячейка single → один slug;
 * группа (legacy) → все варианты по возрастанию cardSplitIndex.
 * Публичные ленты пишут только single — одна плитка на карточку.
 */
export function buildListingSlugOrder(items: ListingNavGridItem[]): string[] {
  const out: string[] = [];
  for (const item of items) {
    if (item.type === "single") {
      const s = normalizeSlug(item.card.slug);
      if (s) out.push(s);
    } else {
      const sorted = [...item.cards].sort(
        (a, b) => a.cardSplitIndex - b.cardSplitIndex
      );
      for (const c of sorted) {
        const s = normalizeSlug(c.slug);
        if (s) out.push(s);
      }
    }
  }
  return out;
}

/**
 * При превышении лимита оставляем **хвост** списка: актуально при infinite scroll,
 * когда пользователь уже прокрутил далеко от первой страницы.
 */
export function capListingSlugList(slugs: string[]): string[] {
  if (slugs.length <= LISTING_CARD_NAV_MAX_SLUGS) return slugs;
  return slugs.slice(-LISTING_CARD_NAV_MAX_SLUGS);
}

export function writeListingNavigationContext(
  slugs: string[],
  options?: ListingNavigationWriteOptions
): void {
  if (options && "sourceId" in options) {
    activeNavigationSourceId = options.sourceId ?? null;
  } else if (!options) {
    activeNavigationSourceId = null;
  }
  activeNavigationHasMore = Boolean(options?.hasMore);

  if (typeof window === "undefined") return;
  try {
    const capped = capListingSlugList(slugs);
    const payload: StoredPayload = {
      slugs: capped,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(
      LISTING_CARD_NAV_STORAGE_KEY,
      JSON.stringify(payload)
    );
    dispatchWindowEvent(LISTING_CARD_NAV_UPDATED_EVENT);
  } catch {
    /* квота / приватный режим */
    dispatchWindowEvent(LISTING_CARD_NAV_UPDATED_EVENT);
  }
}

export function syncListingNavigationPaginationState({
  sourceId,
  hasMore,
}: {
  sourceId: string;
  hasMore: boolean;
}): void {
  if (activeNavigationSourceId !== sourceId) return;
  const nextHasMore = Boolean(hasMore);
  if (activeNavigationHasMore === nextHasMore) return;
  activeNavigationHasMore = nextHasMore;
  dispatchWindowEvent(LISTING_CARD_NAV_UPDATED_EVENT);
}

export function canLoadMoreListingNavigation(): boolean {
  if (!activeNavigationHasMore) return false;
  return getMatchingLoadMoreHandlers().length > 0;
}

export function isListingNavigationLoadingMore(): boolean {
  return activeNavigationLoading;
}

export function getActiveListingNavigationSourceId(): string | null {
  return activeNavigationSourceId;
}

export function primeListingNavigationCardData(cards: CardPageData[]): void {
  for (const card of cards.slice(-LISTING_CARD_NAV_MAX_SLUGS)) {
    if (!card?.slug) continue;
    listingCardDataBySlug.delete(card.slug);
    listingCardDataBySlug.set(card.slug, card);
  }
  while (listingCardDataBySlug.size > LISTING_CARD_DATA_CACHE_MAX) {
    const oldest = listingCardDataBySlug.keys().next().value as
      | string
      | undefined;
    if (!oldest) break;
    listingCardDataBySlug.delete(oldest);
  }
}

export function toListingCardPageData(
  card: PromptCardFull,
  groupCards: PromptCardFull[] = []
): CardPageData {
  const isSplitGroup = card.cardSplitTotal > 1;
  const normalizedGroupCards = isSplitGroup
    ? groupCards.filter(
        (sibling) =>
          sibling.id !== card.id && sibling.cardSplitTotal > 1
      )
    : [];
  const siblings = normalizedGroupCards.map((sibling) => ({
    id: sibling.id,
    slug: sibling.slug,
    title_ru: sibling.title_ru,
    card_split_index: sibling.cardSplitIndex,
    mainPhotoUrl: sibling.photoUrls[0] || null,
  }));
  const seoTags =
    card.seo_tags && typeof card.seo_tags === "object"
      ? (card.seo_tags as Record<string, unknown>)
      : null;

  return {
    id: card.id,
    slug: card.slug,
    title_ru: card.title_ru,
    title_en: card.title_en,
    seo_tags: seoTags,
    hashtags: card.hashtags,
    source_date: card.sourceDate,
    source_dataset_slug: card.datasetSlug,
    source_message_id: card.sourceMessageId,
    seo_readiness_score: card.seoReadinessScore,
    promptTexts: card.promptTexts,
    photoUrls: card.photoUrls,
    photoMeta: card.photoMeta,
    photoDimensions: card.photoMeta.map((photo) => ({
      width: photo.width,
      height: photo.height,
    })),
    beforePhotoUrl: card.beforePhotoUrl,
    videoUrl: card.videoUrl ?? null,
    mainPhotoUrl: card.photoUrls[0] || null,
    card_split_index: card.cardSplitIndex,
    card_split_total: card.cardSplitTotal,
    siblings,
    groupFirstSlug: isSplitGroup ? groupCards[0]?.slug ?? null : null,
    likesCount: card.likesCount,
    dislikesCount: card.dislikesCount,
    viewCount: card.viewCount,
    isPublished: card.isPublished ?? true,
    moderationStatus: "none",
    authorUserId: null,
    authorAvatarUrl: null,
    authorDisplayName: null,
    viewerIsOwner: false,
  };
}

/**
 * Keeps the already-fetched listing payload in memory for zero-network modal
 * navigation. localStorage remains slug-only to avoid persisting large prompts.
 */
export function primeListingNavigationCards(cards: PromptCardFull[]): void {
  const groups = new Map<string, PromptCardFull[]>();
  for (const card of cards) {
    if (!card.sourceGroupKey || card.cardSplitTotal <= 1) continue;
    const group = groups.get(card.sourceGroupKey) ?? [];
    group.push(card);
    groups.set(card.sourceGroupKey, group);
  }

  const cardData = cards
    .slice(-LISTING_CARD_NAV_MAX_SLUGS)
    .map((card) => {
      const groupCards = card.sourceGroupKey
        ? [...(groups.get(card.sourceGroupKey) ?? [])].sort(
            (a, b) => a.cardSplitIndex - b.cardSplitIndex
          )
        : [];
      return toListingCardPageData(card, groupCards);
    });
  primeListingNavigationCardData(cardData);
}

export function readListingNavigationCard(
  slug: string
): CardPageData | null {
  return listingCardDataBySlug.get(slug) ?? null;
}

/**
 * Ask the currently active mounted listing/search controller to append its next page.
 * Deduplicates concurrent in-flight requests and emits `UPDATED` + `LOAD_MORE_SETTLED`
 * once React has had a frame to commit the appended cards.
 */
export function requestListingNavigationLoadMore(): Promise<void> {
  if (inflightLoadMorePromise) {
    return inflightLoadMorePromise;
  }

  const handlers = getMatchingLoadMoreHandlers();
  dispatchWindowEvent(LISTING_CARD_NAV_LOAD_MORE_EVENT);
  if (handlers.length === 0) {
    dispatchWindowEvent(LISTING_CARD_NAV_LOAD_MORE_SETTLED_EVENT);
    return Promise.resolve();
  }

  activeNavigationLoading = true;
  dispatchWindowEvent(LISTING_CARD_NAV_UPDATED_EVENT);

  const run = (async () => {
    try {
      await Promise.all(handlers.map((fn) => Promise.resolve(fn())));
      await waitNextCommitTurn();
    } catch {
      /* individual feed handles UI error state */
    } finally {
      activeNavigationLoading = false;
      inflightLoadMorePromise = null;
      dispatchWindowEvent(LISTING_CARD_NAV_UPDATED_EVENT);
      dispatchWindowEvent(LISTING_CARD_NAV_LOAD_MORE_SETTLED_EVENT);
    }
  })();

  inflightLoadMorePromise = run;
  return run;
}

export function subscribeListingNavigationUpdates(
  listener: () => void
): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(LISTING_CARD_NAV_UPDATED_EVENT, listener);
  return () =>
    window.removeEventListener(LISTING_CARD_NAV_UPDATED_EVENT, listener);
}

export function subscribeListingNavigationLoadMore(
  listener: LoadMoreHandler,
  options?: { sourceId?: string | null }
): () => void {
  const sourceId = options?.sourceId ?? null;
  loadMoreSubscribers.set(listener, sourceId);
  dispatchWindowEvent(LISTING_CARD_NAV_UPDATED_EVENT);
  return () => {
    loadMoreSubscribers.delete(listener);
    dispatchWindowEvent(LISTING_CARD_NAV_UPDATED_EVENT);
  };
}

export function subscribeListingNavigationLoadMoreSettled(
  listener: () => void
): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(LISTING_CARD_NAV_LOAD_MORE_SETTLED_EVENT, listener);
  return () =>
    window.removeEventListener(
      LISTING_CARD_NAV_LOAD_MORE_SETTLED_EVENT,
      listener
    );
}

export function readListingNavigationContext(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LISTING_CARD_NAV_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPayload | null;
    if (!parsed || !Array.isArray(parsed.slugs)) return null;
    const slugs = parsed.slugs.filter((s): s is string => typeof s === "string");
    return slugs.length === 0 ? null : slugs;
  } catch {
    return null;
  }
}

export type ListingCardNavNeighbors = {
  prevSlug: string | null;
  nextSlug: string | null;
};

/** `null`, если текущего slug нет в сохранённом списке (или список пуст). */
export function resolveListingNavNeighbors(
  currentSlug: string
): ListingCardNavNeighbors | null {
  const trimmed = normalizeSlug(currentSlug);
  if (!trimmed) return null;
  const slugs = readListingNavigationContext();
  if (!slugs?.length) return null;
  const i = slugs.indexOf(trimmed);
  if (i < 0) return null;
  return {
    prevSlug: i > 0 ? slugs[i - 1]! : null,
    nextSlug: i < slugs.length - 1 ? slugs[i + 1]! : null,
  };
}

export function resetListingNavigationRuntimeForTests(): void {
  listingCardDataBySlug.clear();
  loadMoreSubscribers.clear();
  activeNavigationSourceId = null;
  activeNavigationHasMore = false;
  activeNavigationLoading = false;
  inflightLoadMorePromise = null;
}
