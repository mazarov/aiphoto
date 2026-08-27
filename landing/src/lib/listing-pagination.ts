/**
 * Категорийные листинги `[...slug]`: меньше работы на SSR / первый байт,
 * остальное — `InfiniteGrid` → GET `/api/listing`.
 */
export const LISTING_SSR_INITIAL_LIMIT = 10;

/** Размер следующих порций (и шаг offset в пространстве ranked RPC). */
export const LISTING_INFINITE_PAGE_SIZE = 24;

/** Search-backed listings (`/search` and birthday cluster): hybrid page size. */
export const LISTING_SEARCH_PAGE_SIZE = 48;

/**
 * Per-request page peek for `/api/listing` and `/api/search`.
 * SQL `222` allows `least(500, p_limit)`; listing hybrid materializes 500
 * separately. Public `/api/search` still uses TEXT_SEARCH_MAX_WINDOW (100).
 * Fetch `limit + 1` to know hasMore, so the client limit must stay at 99.
 */
export const LISTING_SEARCH_RPC_MAX_LIMIT = 100;
export const LISTING_SEARCH_API_MAX_LIMIT = LISTING_SEARCH_RPC_MAX_LIMIT - 1;

/** Lookahead for listing/search sentinels. Same value for catalog and `/search`. */
export const LISTING_SENTINEL_ROOT_MARGIN_PX = 600;

/**
 * Fill the viewport from the last visible card, not from the masonry box or
 * a 1px sentinel. A tall empty container must not delay the next page.
 */
export const LISTING_FILL_LOOKAHEAD_PX = 1200;
export const LISTING_FILL_MAX_PAGES_PER_PASS = 3;
export const LISTING_FILL_ITEM_SELECTOR = "[data-listing-fill-item]";

/**
 * Offset/step are ranked RPC units (`cards_count` / `ranked_batch_size`),
 * `totalCount` is `total_count`.
 */
export function hasMoreRankedPages(
  rankedOffset: number,
  rankedStep: number,
  totalCount: number
): boolean {
  if (rankedStep <= 0 || totalCount <= 0) return false;
  return rankedOffset + rankedStep < totalCount;
}

/** Text-search listings have no total_count — a full page means another fetch. */
export function hasMoreSearchPages(
  receivedCount: number,
  requestedLimit: number
): boolean {
  if (requestedLimit <= 0 || receivedCount <= 0) return false;
  return receivedCount >= requestedLimit;
}

/** Fetch `limit + 1` from search RPC, then keep a deterministic page. */
export function takeSearchPage<T>(
  rows: readonly T[],
  requestedLimit: number
): { cards: T[]; hasMore: boolean } {
  const limit = Math.max(0, requestedLimit);
  if (limit <= 0) return { cards: [], hasMore: false };
  return {
    cards: rows.slice(0, limit) as T[],
    hasMore: rows.length > limit,
  };
}

export function resolveListingPageStep(
  rankedBatchSize: number,
  fallback = LISTING_INFINITE_PAGE_SIZE
): number {
  return rankedBatchSize > 0 ? rankedBatchSize : fallback;
}

/**
 * IntersectionObserver fires only on threshold crossing. After a page appends,
 * the sentinel can stay inside rootMargin — we must drain explicitly.
 */
export function shouldDrainListingPage(options: {
  hasMore: boolean;
  loading: boolean;
  restoreInProgress: boolean;
  sentinelInRange: boolean;
}): boolean {
  return (
    options.hasMore &&
    !options.loading &&
    !options.restoreInProgress &&
    options.sentinelInRange
  );
}

export function isListingSentinelInLoadRange(
  sentinel: Pick<Element, "getBoundingClientRect">,
  rootRect: { top: number; bottom: number },
  rootMarginPx = LISTING_SENTINEL_ROOT_MARGIN_PX
): boolean {
  const sentinelRect = sentinel.getBoundingClientRect();
  return (
    sentinelRect.bottom >= rootRect.top - rootMarginPx &&
    sentinelRect.top <= rootRect.bottom + rootMarginPx
  );
}

/**
 * Scroll fallback for fast gestures: unlike the bounded drain check above,
 * a sentinel already skipped above the viewport still counts as reached.
 */
export function hasListingSentinelReachedLoadRange(
  sentinel: Pick<Element, "getBoundingClientRect">,
  rootRect: { bottom: number },
  rootMarginPx = LISTING_SENTINEL_ROOT_MARGIN_PX
): boolean {
  return (
    sentinel.getBoundingClientRect().top <=
    rootRect.bottom + rootMarginPx
  );
}

export function listingContentRemainingPx(
  contentBottom: number,
  viewportBottom: number
): number {
  return contentBottom - viewportBottom;
}

/**
 * Load the next page while the last card is already inside or near the fold.
 * `pagesLoadedThisPass` caps mount/chain fetches so a tall desktop does not
 * pull the whole catalog at once.
 */
export function shouldFillListingPage(options: {
  hasMore: boolean;
  loading: boolean;
  restoreInProgress: boolean;
  remainingPx: number;
  pagesLoadedThisPass: number;
  lookaheadPx?: number;
  maxPagesPerPass?: number;
}): boolean {
  if (!options.hasMore || options.loading || options.restoreInProgress) {
    return false;
  }
  const lookahead = options.lookaheadPx ?? LISTING_FILL_LOOKAHEAD_PX;
  const maxPages = options.maxPagesPerPass ?? LISTING_FILL_MAX_PAGES_PER_PASS;
  if (options.pagesLoadedThisPass >= maxPages) return false;
  return options.remainingPx < lookahead;
}

export function listingScrollRootRect(
  root: { getBoundingClientRect: () => DOMRect } | Window
): { top: number; bottom: number } {
  if (typeof Window !== "undefined" && root instanceof Window) {
    return { top: 0, bottom: window.innerHeight };
  }
  if ("getBoundingClientRect" in root) {
    const rect = root.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom };
  }
  return { top: 0, bottom: 0 };
}
