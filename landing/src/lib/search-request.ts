export type SearchUrlFilters = {
  audience: string | null;
  style: string | null;
  occasion: string | null;
  object: string | null;
};

export function searchRequestKey(
  query: string,
  filters: SearchUrlFilters,
): string {
  return [
    query.trim(),
    filters.audience ?? "",
    filters.style ?? "",
    filters.occasion ?? "",
    filters.object ?? "",
  ].join("\n");
}

export function buildSearchApiParams(options: {
  query: string;
  limit: number;
  offset: number;
  filters: SearchUrlFilters;
}): URLSearchParams {
  const params = new URLSearchParams({
    q: options.query,
    limit: String(options.limit),
    offset: String(options.offset),
  });
  const { filters } = options;
  if (filters.audience) params.set("audience", filters.audience);
  if (filters.style) params.set("style", filters.style);
  if (filters.occasion) params.set("occasion", filters.occasion);
  if (filters.object) params.set("object", filters.object);
  return params;
}
