import { sanitizeUuid } from "./visitor-id";
import { sanitizeCardSlug } from "./search-analytics";

export const SEARCH_NAV_STORAGE_KEY = "promptshot_search_nav_v1";
export const SEARCH_NAV_MAX_AGE_MS = 30 * 60 * 1000;
export const SEARCH_NAV_MAX_SLUGS = 500;

export type SearchNavContext = {
  searchId: string;
  query: string;
  slugs: string[];
  resultCount: number;
  updatedAt: number;
};

let memory: SearchNavContext | null = null;

function isContext(value: unknown): value is SearchNavContext {
  if (!value || typeof value !== "object") return false;
  const row = value as SearchNavContext;
  return (
    typeof row.searchId === "string" &&
    typeof row.query === "string" &&
    Array.isArray(row.slugs) &&
    typeof row.resultCount === "number" &&
    typeof row.updatedAt === "number"
  );
}

function readStorage(): SearchNavContext | null {
  if (typeof window === "undefined") return memory;
  try {
    const raw = window.localStorage.getItem(SEARCH_NAV_STORAGE_KEY);
    if (!raw) return memory;
    const parsed = JSON.parse(raw) as unknown;
    return isContext(parsed) ? parsed : memory;
  } catch {
    return memory;
  }
}

function writeStorage(next: SearchNavContext): void {
  memory = next;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SEARCH_NAV_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode — memory still holds the context */
  }
}

export function writeSearchNavContext(input: {
  searchId: string;
  query: string;
  slugs: string[];
  resultCount: number;
  now?: number;
}): SearchNavContext | null {
  const searchId = sanitizeUuid(input.searchId);
  if (!searchId) return null;
  const slugs = input.slugs
    .map((slug) => sanitizeCardSlug(slug))
    .filter((slug): slug is string => Boolean(slug))
    .slice(0, SEARCH_NAV_MAX_SLUGS);
  const next: SearchNavContext = {
    searchId,
    query: input.query.trim().slice(0, 160),
    slugs,
    resultCount: Math.max(0, Math.min(500, Math.trunc(input.resultCount))),
    updatedAt: input.now ?? Date.now(),
  };
  writeStorage(next);
  return next;
}

export function readSearchNavContext(now = Date.now()): SearchNavContext | null {
  const stored = readStorage();
  if (!stored) return null;
  if (!sanitizeUuid(stored.searchId)) return null;
  if (now - stored.updatedAt > SEARCH_NAV_MAX_AGE_MS) {
    clearSearchNavContext();
    return null;
  }
  return stored;
}

export function clearSearchNavContext(): void {
  memory = null;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SEARCH_NAV_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function matchSearchNavClick(
  slug: string,
  context = readSearchNavContext(),
): { searchId: string; position: number } | null {
  const clean = sanitizeCardSlug(slug);
  if (!clean || !context) return null;
  const position = context.slugs.indexOf(clean);
  if (position < 0) return null;
  return { searchId: context.searchId, position };
}

export function resetSearchNavContextForTests(): void {
  memory = null;
}
