import { LISTING_DEFAULT_SORT } from "@/lib/listing-sort";
import {
  hasMoreRankedPages,
  hasMoreSearchPages,
  resolveListingPageStep,
} from "@/lib/listing-pagination";

/** `/api/listing` params of one homepage gallery feed, without limit/offset. */
export type HomeFeedQuery = Record<string, string>;

/** «Все»: same query the SSR page ran (`resolve_route_cards`, popular, no tags). */
export const HOME_ALL_FEED: HomeFeedQuery = { sort: LISTING_DEFAULT_SORT };

export function homeFeedQuery(
  query: string,
  chip: { dimension: string; slug: string } | null,
): HomeFeedQuery {
  const trimmed = query.trim();
  if (trimmed.length >= 2) return { q: trimmed };
  if (chip) return { [chip.dimension]: chip.slug, sort: LISTING_DEFAULT_SORT, strict: "1" };
  return HOME_ALL_FEED;
}

export function homeFeedUrl(feed: HomeFeedQuery, offset: number, limit: number): string {
  const params = new URLSearchParams(feed);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return `/api/listing?${params.toString()}`;
}

/**
 * Next offset is in ranked units (`ranked_batch_size`), not enriched card count:
 * photoshoot siblings would otherwise skip or repeat rows.
 */
export function readHomeFeedPage(input: {
  feed: HomeFeedQuery;
  offset: number;
  limit: number;
  receivedCards: number;
  rankedBatchSize: unknown;
  totalCount: unknown;
  hasMore: unknown;
}): { nextOffset: number; hasMore: boolean } {
  const ranked = Math.max(0, Number(input.rankedBatchSize) || 0);
  if (ranked === 0 && input.receivedCards === 0) {
    return { nextOffset: input.offset, hasMore: false };
  }
  if (input.feed.q) {
    const step = ranked || input.receivedCards;
    return {
      nextOffset: input.offset + step,
      hasMore:
        typeof input.hasMore === "boolean"
          ? input.hasMore
          : hasMoreSearchPages(step, input.limit),
    };
  }
  const step = resolveListingPageStep(ranked);
  const total = Math.max(0, Number(input.totalCount) || 0);
  return {
    nextOffset: input.offset + step,
    hasMore: hasMoreRankedPages(input.offset, step, total),
  };
}
