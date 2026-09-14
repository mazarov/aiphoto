"use client";

import { browserAcquisitionIds } from "./acquisition-client-events";
import {
  canonicalizeSearchFilters,
  normalizeSearchQuery,
  resolveSearchIdForCommit,
} from "./search-analytics";
import { matchSearchNavClick } from "./search-nav-context";
import { searchRequestKey, type SearchUrlFilters } from "./search-request";

function postSearchEvent(body: Record<string, unknown>): void {
  void fetch("/api/search-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify(body),
  }).catch(() => {});
}

export function recordCommittedSearch(input: {
  requestKey?: string;
  query: string;
  resultCount: number;
  hasMore: boolean;
  matchType: string | null;
  limitSize: number;
  filters: SearchUrlFilters;
  existingSearchId?: string | null;
  pagePath?: string | null;
}): string | null {
  const query = normalizeSearchQuery(input.query);
  if (!query) return null;
  const { visitorId, sessionId } = browserAcquisitionIds();
  if (!visitorId || !sessionId) return null;
  const filters = canonicalizeSearchFilters(input.filters);
  const requestKey =
    input.requestKey ?? searchRequestKey(query.raw, input.filters);
  const { searchId, shouldIngest } = resolveSearchIdForCommit({
    requestKey,
    sessionId,
    queryNorm: query.norm,
    filtersKey: JSON.stringify(filters),
    existing: input.existingSearchId,
  });
  if (shouldIngest) {
    postSearchEvent({
      event: "search",
      searchId,
      visitorId,
      sessionId,
      query: query.raw,
      resultCount: input.resultCount,
      hasMore: input.hasMore,
      matchType: input.matchType,
      limitSize: input.limitSize,
      filters,
      pagePath:
        input.pagePath ||
        (typeof location === "undefined" ? null : location.pathname + location.search),
    });
  }
  return searchId;
}

export function recordSearchCardClick(
  slug: string,
  entry: "modal" | "page",
): void {
  const match = matchSearchNavClick(slug);
  if (!match) return;
  const { visitorId, sessionId } = browserAcquisitionIds();
  if (!visitorId || !sessionId) return;
  postSearchEvent({
    event: "search_click",
    searchId: match.searchId,
    visitorId,
    sessionId,
    cardSlug: slug,
    position: match.position,
    entry,
  });
}
