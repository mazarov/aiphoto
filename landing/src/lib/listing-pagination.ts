/**
 * Категорийные листинги `[...slug]`: меньше работы на SSR / первый байт,
 * остальное — `InfiniteGrid` → GET `/api/listing`.
 */
export const LISTING_SSR_INITIAL_LIMIT = 10;

/** Размер следующих порций (и шаг offset в пространстве ranked RPC). */
export const LISTING_INFINITE_PAGE_SIZE = 48;

/** Lookahead for listing/search sentinels. Same value for catalog and `/search`. */
export const LISTING_SENTINEL_ROOT_MARGIN_PX = 600;

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
