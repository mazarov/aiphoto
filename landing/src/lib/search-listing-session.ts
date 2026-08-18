/**
 * Search listing session: keep /search results across the prompt-card overlay.
 *
 * Next 15 syncs `history.pushState('/p/slug')` into `usePathname` / `useSearchParams`.
 * Without this, SearchResults treats the overlay URL as an empty query, clears the
 * loaded pages, and `resetListingScroll()` wipes the saved modal-restore position.
 */

import {
  isListingOverlayPath,
  normalizeNavPath,
} from "@/lib/scroll-preservation";
import { searchRequestKey, type SearchUrlFilters } from "@/lib/search-request";
import type { PromptCardFull } from "@/lib/supabase";

const EMPTY_FILTERS: SearchUrlFilters = {
  audience: null,
  style: null,
  occasion: null,
  object: null,
};

export type SearchListingSnapshot = {
  requestKey: string;
  query: string;
  cardPages: PromptCardFull[][];
  offset: number;
  hasMore: boolean;
  matchType: string | null;
  searched: boolean;
};

export type SearchUrlSyncAction = "ignore" | "keep" | "search";

let snapshot: SearchListingSnapshot | null = null;

export function writeSearchListingSnapshot(
  next: SearchListingSnapshot
): void {
  snapshot = next;
}

export function readSearchListingSnapshot(
  requestKey: string
): SearchListingSnapshot | null {
  if (!snapshot || snapshot.requestKey !== requestKey) return null;
  return snapshot;
}

export function clearSearchListingSnapshot(): void {
  snapshot = null;
}

/** Test helper — not used by the listing UI. */
export function resetSearchListingSnapshotForTests(): void {
  snapshot = null;
}

/**
 * Whether `/search` should treat the current URL query as a new search.
 * Overlay routes keep the in-memory listing; same query is a no-op.
 */
export function resolveSearchUrlSync(input: {
  pathname: string;
  urlRequestKey: string;
  lastSearched: string | null;
}): SearchUrlSyncAction {
  if (isListingOverlayPath(input.pathname)) return "ignore";
  if (normalizeNavPath(input.pathname) !== "/search") return "ignore";
  const last = input.lastSearched ?? searchRequestKey("", EMPTY_FILTERS);
  if (input.urlRequestKey === last) return "keep";
  return "search";
}
