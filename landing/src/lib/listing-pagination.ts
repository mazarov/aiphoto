/**
 * Категорийные листинги `[...slug]`: меньше работы на SSR / первый байт,
 * остальное — `InfiniteGrid` → GET `/api/listing`.
 */
export const LISTING_SSR_INITIAL_LIMIT = 10;

/** Размер следующих порций (и шаг offset в пространстве ranked RPC). */
export const LISTING_INFINITE_PAGE_SIZE = 48;
