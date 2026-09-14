import { sanitizeUuid } from "./visitor-id";
import type { SearchUrlFilters } from "./search-request";

export const MAX_SEARCH_QUERY_LENGTH = 160;
export const MAX_SEARCH_FILTER_LENGTH = 80;
export const MAX_SEARCH_PAGE_PATH_LENGTH = 200;
export const SEARCH_INGEST_DEDUP_MS = 30_000;
export const SEARCH_CLICK_ENTRIES = ["modal", "page"] as const;

export type SearchClickEntry = (typeof SEARCH_CLICK_ENTRIES)[number];

export type CanonicalSearchFilters = {
  audience?: string;
  style?: string;
  occasion?: string;
  object?: string;
};

const FILTER_KEYS = ["audience", "style", "occasion", "object"] as const;

const searchIdsByRequestKey = new Map<string, string>();
const ingestedSearchIds = new Set<string>();
const recentIngestBySignature = new Map<string, { at: number; searchId: string }>();

export function normalizeSearchQuery(raw: unknown): { raw: string; norm: string } | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .replace(/\s+/g, " ");
  if (cleaned.length < 2 || cleaned.length > MAX_SEARCH_QUERY_LENGTH) return null;
  return { raw: cleaned, norm: cleaned.toLowerCase() };
}

export function canonicalizeSearchFilters(
  filters: SearchUrlFilters | null | undefined,
): CanonicalSearchFilters {
  const out: CanonicalSearchFilters = {};
  if (!filters) return out;
  for (const key of FILTER_KEYS) {
    const value = filters[key]?.trim();
    if (value) out[key] = value.slice(0, MAX_SEARCH_FILTER_LENGTH);
  }
  return out;
}

export function parseSearchFilters(raw: unknown): CanonicalSearchFilters {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const input = raw as Record<string, unknown>;
  return canonicalizeSearchFilters({
    audience: typeof input.audience === "string" ? input.audience : null,
    style: typeof input.style === "string" ? input.style : null,
    occasion: typeof input.occasion === "string" ? input.occasion : null,
    object: typeof input.object === "string" ? input.object : null,
  });
}

export function searchFiltersKey(filters: SearchUrlFilters | CanonicalSearchFilters): string {
  const canonical =
    "audience" in filters || "style" in filters
      ? canonicalizeSearchFilters({
          audience: (filters as SearchUrlFilters).audience ?? (filters as CanonicalSearchFilters).audience ?? null,
          style: (filters as SearchUrlFilters).style ?? (filters as CanonicalSearchFilters).style ?? null,
          occasion: (filters as SearchUrlFilters).occasion ?? (filters as CanonicalSearchFilters).occasion ?? null,
          object: (filters as SearchUrlFilters).object ?? (filters as CanonicalSearchFilters).object ?? null,
        })
      : canonicalizeSearchFilters(filters as SearchUrlFilters);
  return JSON.stringify(canonical);
}

export function searchDedupSignature(
  sessionId: string,
  queryNorm: string,
  filtersKey: string,
): string {
  return `${sessionId}\n${queryNorm}\n${filtersKey}`;
}

export function isSearchClickEntry(value: unknown): value is SearchClickEntry {
  return value === "modal" || value === "page";
}

export function sanitizeSearchPagePath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/[\u0000-\u001f\u007f]/g, "");
  if (!cleaned.startsWith("/")) return null;
  return cleaned.slice(0, MAX_SEARCH_PAGE_PATH_LENGTH);
}

export function sanitizeMatchType(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/[\u0000-\u001f\u007f]/g, "");
  return cleaned ? cleaned.slice(0, 40) : null;
}

export function sanitizeCardSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/[\u0000-\u001f\u007f]/g, "");
  return cleaned ? cleaned.slice(0, 280) : null;
}

export function sanitizeResultCount(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 500) return null;
  return n;
}

export function sanitizeLimitSize(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 100) return null;
  return n;
}

export function sanitizeClickPosition(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 500) return null;
  return n;
}

export function markSearchEventIngested(searchId: string): boolean {
  if (ingestedSearchIds.has(searchId)) return false;
  ingestedSearchIds.add(searchId);
  return true;
}

export function rememberSearchIngest(
  signature: string,
  searchId: string,
  now = Date.now(),
): void {
  recentIngestBySignature.set(signature, { at: now, searchId });
}

export function findRecentSearchIngest(
  signature: string,
  now = Date.now(),
  windowMs = SEARCH_INGEST_DEDUP_MS,
): string | null {
  const entry = recentIngestBySignature.get(signature);
  if (!entry) return null;
  if (now - entry.at > windowMs) {
    recentIngestBySignature.delete(signature);
    return null;
  }
  return entry.searchId;
}

export function resolveSearchIdForCommit(input: {
  requestKey: string;
  sessionId: string | null;
  queryNorm: string;
  filtersKey: string;
  existing?: string | null;
  now?: number;
  mint?: () => string;
}): { searchId: string; shouldIngest: boolean } {
  const now = input.now ?? Date.now();
  const existing = sanitizeUuid(input.existing);
  if (existing) {
    searchIdsByRequestKey.set(input.requestKey, existing);
    return { searchId: existing, shouldIngest: markSearchEventIngested(existing) };
  }

  const cached = searchIdsByRequestKey.get(input.requestKey);
  if (cached) {
    return { searchId: cached, shouldIngest: markSearchEventIngested(cached) };
  }

  const signature = input.sessionId
    ? searchDedupSignature(input.sessionId, input.queryNorm, input.filtersKey)
    : null;
  if (signature) {
    const recent = findRecentSearchIngest(signature, now);
    if (recent) {
      searchIdsByRequestKey.set(input.requestKey, recent);
      return { searchId: recent, shouldIngest: false };
    }
  }

  const minted = sanitizeUuid(input.mint ? input.mint() : crypto.randomUUID());
  if (!minted) {
    throw new Error("mint produced invalid search id");
  }
  searchIdsByRequestKey.set(input.requestKey, minted);
  if (signature) rememberSearchIngest(signature, minted, now);
  return { searchId: minted, shouldIngest: markSearchEventIngested(minted) };
}

export function resetSearchAnalyticsStateForTests(): void {
  searchIdsByRequestKey.clear();
  ingestedSearchIds.clear();
  recentIngestBySignature.clear();
}
