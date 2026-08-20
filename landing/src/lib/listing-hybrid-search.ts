import { isBirthdayListingSearchQuery } from "@/lib/den-rozhdeniya-cluster";
import { takeSearchPage } from "@/lib/listing-pagination";
import {
  createSupabaseServer,
  searchCardsByText,
  searchCardsByVisualEmbedding,
  type SearchTextResult,
} from "@/lib/supabase";
import {
  createSingleFlight,
  createTtlLruCache,
} from "@/lib/visual-search-cache";
import { getVisualSearchConfig } from "@/lib/visual-search-config";
import {
  runHybridCardSearch,
  type HybridSearchDeps,
  type HybridSearchResult,
  type HybridSearchTimings,
} from "@/lib/visual-search";
import {
  embedSearchQueryWithGuards,
  visualQueryCacheKey,
  type VisualBudgetActor,
} from "@/lib/visual-search-guard";

export const LISTING_HYBRID_MATERIALIZE_LIMIT = 200;
export const LISTING_HYBRID_RESULT_TTL_MS = 60 * 60 * 1000;
export const LISTING_HYBRID_SLOW_MS = 750;

export const listingHybridSearchDeps: HybridSearchDeps = {
  searchText: searchCardsByText,
  searchVisual: searchCardsByVisualEmbedding,
  embedQuery: embedSearchQueryWithGuards,
};

type CachedListingHybrid = {
  cards: SearchTextResult[];
  matchType: string | null;
  outcome: Extract<HybridSearchResult["outcome"], "hybrid">;
};

const listingResultCache = createTtlLruCache<CachedListingHybrid>(
  32,
  LISTING_HYBRID_RESULT_TTL_MS,
);
const listingResultFlight = createSingleFlight<HybridSearchResult>();

export type ListingHybridSearchResult = {
  cards: SearchTextResult[];
  hasMore: boolean;
  matchType: string | null;
  outcome: HybridSearchResult["outcome"];
  fallbackReason?: string;
  allowlisted: boolean;
  budgetActor: VisualBudgetActor;
  resultCacheHit: boolean;
  vectorCacheHit: boolean;
  timings: HybridSearchTimings;
  textCount: number;
  visualCount: number;
};

function emptyTimings(): HybridSearchTimings {
  return { textMs: 0, embedMs: 0, vectorMs: 0, rankMs: 0 };
}

function listingResultCacheKey(query: string): string {
  return visualQueryCacheKey(query, getVisualSearchConfig());
}

function sliceCachedPage(
  cards: SearchTextResult[],
  limit: number,
  offset: number,
): { cards: SearchTextResult[]; hasMore: boolean } {
  return takeSearchPage(cards.slice(Math.max(0, offset)), limit);
}

async function searchTextPage(options: {
  query: string;
  limit: number;
  offset: number;
  deps: HybridSearchDeps;
}): Promise<Pick<ListingHybridSearchResult, "cards" | "hasMore" | "matchType" | "timings" | "textCount">> {
  const started = performance.now();
  const hits = await options.deps.searchText(
    options.query,
    options.limit + 1,
    options.offset,
  );
  const page = takeSearchPage(hits, options.limit);
  return {
    cards: page.cards,
    hasMore: page.hasMore,
    matchType: page.cards[0]?.match_type ?? null,
    timings: { ...emptyTimings(), textMs: performance.now() - started },
    textCount: hits.length,
  };
}

/**
 * Birthday SSOT queries: hybrid + 1h result cache + system Gemini budget.
 * Any other `q` stays FTS-only so listing cannot burn the interactive search budget.
 */
export async function searchListingCardsHybrid(options: {
  query: string;
  limit: number;
  offset: number;
  headers: Headers;
  supabase?: Parameters<typeof runHybridCardSearch>[0]["supabase"];
  deps?: HybridSearchDeps;
  now?: Date;
}): Promise<ListingHybridSearchResult> {
  const deps = options.deps ?? listingHybridSearchDeps;
  const allowlisted = isBirthdayListingSearchQuery(options.query);
  const visualEnabled = getVisualSearchConfig().enabled;

  if (!allowlisted || !visualEnabled) {
    const page = await searchTextPage({
      query: options.query,
      limit: options.limit,
      offset: options.offset,
      deps,
    });
    return {
      ...page,
      outcome: "text",
      allowlisted,
      budgetActor: "system",
      resultCacheHit: false,
      vectorCacheHit: false,
      visualCount: 0,
    };
  }

  const cacheKey = listingResultCacheKey(options.query);
  const cached = listingResultCache.get(cacheKey);
  if (cached) {
    const page = sliceCachedPage(cached.cards, options.limit, options.offset);
    return {
      cards: page.cards,
      hasMore: page.hasMore,
      matchType: cached.matchType,
      outcome: cached.outcome,
      allowlisted: true,
      budgetActor: "system",
      resultCacheHit: true,
      vectorCacheHit: true,
      timings: emptyTimings(),
      textCount: cached.cards.length,
      visualCount: 0,
    };
  }

  const hybrid = await listingResultFlight.run(cacheKey, async () => {
    const replay = listingResultCache.get(cacheKey);
    if (replay) {
      return {
        cards: replay.cards,
        matchType: replay.matchType,
        outcome: replay.outcome,
        timings: emptyTimings(),
        textCount: replay.cards.length,
        visualCount: 0,
        cacheHit: true,
        circuitState: "closed",
      } satisfies HybridSearchResult;
    }

    return runHybridCardSearch({
      query: options.query,
      limit: LISTING_HYBRID_MATERIALIZE_LIMIT,
      offset: 0,
      headers: options.headers,
      supabase: options.supabase ?? createSupabaseServer(),
      deps,
      now: options.now,
      budgetActor: "system",
    });
  });

  if (hybrid.outcome === "hybrid") {
    listingResultCache.set(cacheKey, {
      cards: hybrid.cards,
      matchType: hybrid.matchType,
      outcome: "hybrid",
    });
  }

  const page = sliceCachedPage(hybrid.cards, options.limit, options.offset);
  return {
    cards: page.cards,
    hasMore: page.hasMore,
    matchType: hybrid.matchType,
    outcome: hybrid.outcome,
    fallbackReason: hybrid.fallbackReason,
    allowlisted: true,
    budgetActor: "system",
    resultCacheHit: false,
    vectorCacheHit: hybrid.cacheHit,
    timings: hybrid.timings,
    textCount: hybrid.textCount,
    visualCount: hybrid.visualCount,
  };
}

export function logListingHybridSearch(info: {
  source: "ssr" | "api";
  queryLength: number;
  limit: number;
  offset: number;
  resultCount: number;
  hasMore: boolean;
  outcome: HybridSearchResult["outcome"];
  fallbackReason?: string;
  allowlisted: boolean;
  resultCacheHit: boolean;
  vectorCacheHit: boolean;
  textCount: number;
  visualCount: number;
  timings: HybridSearchTimings;
  totalMs: number;
}): void {
  const slow = info.totalMs >= LISTING_HYBRID_SLOW_MS;
  if (info.outcome !== "text_fallback" && !slow) return;
  console.warn(
    info.outcome === "text_fallback"
      ? "[listing-search:fallback]"
      : "[listing-search:slow]",
    {
      source: info.source,
      queryLength: info.queryLength,
      limit: info.limit,
      offset: info.offset,
      resultCount: info.resultCount,
      hasMore: info.hasMore,
      outcome: info.outcome,
      fallbackReason: info.fallbackReason ?? null,
      allowlisted: info.allowlisted,
      resultCacheHit: info.resultCacheHit,
      vectorCacheHit: info.vectorCacheHit,
      textCount: info.textCount,
      visualCount: info.visualCount,
      totalMs: Math.round(info.totalMs),
      textMs: Math.round(info.timings.textMs),
      embedMs: Math.round(info.timings.embedMs),
      vectorMs: Math.round(info.timings.vectorMs),
      rankMs: Math.round(info.timings.rankMs),
    },
  );
}

export function resetListingHybridSearchForTests() {
  listingResultCache.clear();
}
