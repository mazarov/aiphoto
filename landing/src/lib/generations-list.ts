export const GENERATIONS_PAGE_SIZE = 24;
export const GENERATIONS_API_MAX_LIMIT = 50;

export function takeGenerationPage<T>(
  rows: readonly T[],
  limit: number,
): { page: T[]; hasMore: boolean } {
  if (limit <= 0) return { page: [], hasMore: false };
  return {
    page: rows.slice(0, limit),
    hasMore: rows.length > limit,
  };
}

export function mergeGenerationFirstPage<T extends { id: string }>(
  previous: readonly T[],
  fresh: readonly T[],
): T[] {
  const freshIds = new Set(fresh.map((item) => item.id));
  return [...fresh, ...previous.filter((item) => !freshIds.has(item.id))];
}
