import {
  expandSearchSynonymQuery,
  isPersistableSearchQuery,
  normalizeSearchQueryForCache,
} from "@/lib/search-query-normalize";
import {
  createSingleFlight,
  createTtlLruCache,
} from "@/lib/visual-search-cache";
import {
  SEARCH_HYBRID_MATERIALIZE_LIMIT,
  SEARCH_HYBRID_RESULT_MAX_ENTRIES,
  SEARCH_HYBRID_RESULT_TTL_MS,
  TEXT_SEARCH_MAX_WINDOW,
  VISUAL_SEARCH_RPC_MAX_WINDOW,
  resolveVisualSearchConfig,
  visualSearchWindowSize,
  type VisualSearchConfig,
} from "@/lib/visual-search-config";
import {
  embedSearchQueryWithGuards,
  visualQueryCacheKey,
  type VisualBudgetActor,
  type VisualEmbedSource,
} from "@/lib/visual-search-guard";
import { mergeHybridSearchResults, type SearchRankCard } from "@/lib/visual-search-rank";
import type {
  SearchCardFilters,
  SearchTextResult,
  SearchVisualResult,
} from "@/lib/supabase";

export type HybridSearchTimings = {
  textMs: number;
  embedMs: number;
  vectorMs: number;
  rankMs: number;
};

export type PersistableQueryEmbedPayload = {
  query: string;
  queryHash: string;
  vector: number[];
  config: Pick<VisualSearchConfig, "model" | "generation" | "useTaskPrefix">;
};

export type HybridSearchResult = {
  cards: SearchTextResult[];
  matchType: string | null;
  outcome: "text" | "hybrid" | "text_fallback";
  fallbackReason?: string;
  timings: HybridSearchTimings;
  textCount: number;
  visualCount: number;
  cacheHit: boolean;
  resultCacheHit: boolean;
  embedSource: VisualEmbedSource;
  circuitState: string;
  liveEmbedToPersist?: PersistableQueryEmbedPayload | null;
};

export type HybridSearchDeps = {
  searchText: (
    query: string,
    limit: number,
    offset: number,
    filters?: SearchCardFilters,
    synonymQuery?: string | null,
  ) => Promise<SearchTextResult[]>;
  searchVisual: (
    embedding: number[],
    limit: number,
    offset: number,
    generation?: number,
    filters?: SearchCardFilters,
    maxDistance?: number | null,
  ) => Promise<SearchVisualResult[]>;
  embedQuery: typeof embedSearchQueryWithGuards;
};

type CachedSearchResultEntry = {
  cards: SearchTextResult[];
  matchType: string | null;
  outcome: "text" | "hybrid";
  textCount: number;
  visualCount: number;
  embedSource: VisualEmbedSource;
};

const searchResultCache = createTtlLruCache<CachedSearchResultEntry>(
  SEARCH_HYBRID_RESULT_MAX_ENTRIES,
  SEARCH_HYBRID_RESULT_TTL_MS,
);
const searchResultFlight = createSingleFlight<HybridSearchResult>();

export function resetHybridSearchResultCacheForTests(): void {
  searchResultCache.clear();
}

function emptyTimings(): HybridSearchTimings {
  return {
    textMs: 0,
    embedMs: 0,
    vectorMs: 0,
    rankMs: 0,
  };
}

function sliceTextPage(
  cards: SearchTextResult[],
  limit: number,
  offset: number,
): SearchTextResult[] {
  return cards.slice(offset, offset + limit);
}

function filtersCachePart(filters?: SearchCardFilters): string {
  if (!filters) return "{}";
  return JSON.stringify({
    a: filters.audience_tag ?? null,
    s: filters.style_tag ?? null,
    oc: filters.occasion_tag ?? null,
    ob: filters.object_tag ?? null,
  });
}

function buildResultCacheKey(
  query: string,
  filters: SearchCardFilters | undefined,
  config: VisualSearchConfig,
): string {
  return [
    visualQueryCacheKey(query, config),
    filtersCachePart(filters),
    config.enabled ? "1" : "0",
    String(config.generation),
    config.maxVisualDistance === null ? "none" : config.maxVisualDistance.toFixed(4),
  ].join(":");
}

async function executeHybridCardSearchUncached(options: {
  query: string;
  limit: number;
  offset: number;
  filters?: SearchCardFilters;
  headers: Headers;
  supabase: Parameters<typeof embedSearchQueryWithGuards>[0]["supabase"];
  deps: HybridSearchDeps;
  config: VisualSearchConfig;
  now?: Date;
  budgetActor?: VisualBudgetActor;
  textMaxWindow?: number;
}): Promise<HybridSearchResult> {
  const { config } = options;
  const started = performance.now();
  const normalizedQuery = normalizeSearchQueryForCache(options.query) || options.query;
  const synonymQuery = expandSearchSynonymQuery(options.query);

  if (!config.enabled) {
    const cards = await options.deps.searchText(
      normalizedQuery,
      options.limit,
      options.offset,
      options.filters,
      synonymQuery,
    );
    return {
      cards,
      matchType: cards[0]?.match_type ?? null,
      outcome: "text",
      timings: { ...emptyTimings(), textMs: performance.now() - started },
      textCount: cards.length,
      visualCount: 0,
      cacheHit: false,
      resultCacheHit: false,
      embedSource: "none",
      circuitState: "closed",
      liveEmbedToPersist: null,
    };
  }

  const windowSize = visualSearchWindowSize(options.limit, options.offset);
  const textCap = options.textMaxWindow ?? TEXT_SEARCH_MAX_WINDOW;
  const textWindow = Math.min(textCap, windowSize);
  const visualWindow = Math.min(VISUAL_SEARCH_RPC_MAX_WINDOW, windowSize);

  const textPromise = options.deps.searchText(
    normalizedQuery,
    textWindow,
    0,
    options.filters,
    synonymQuery,
  );
  const embedStarted = performance.now();
  const embedPromise = options.deps.embedQuery({
    query: options.query,
    headers: options.headers,
    supabase: options.supabase,
    config,
    now: options.now,
    budgetActor: options.budgetActor,
  });

  const [textCards, embed] = await Promise.all([textPromise, embedPromise]);
  const textMs = performance.now() - started;
  const embedMs = performance.now() - embedStarted;

  if (!embed.ok) {
    return {
      cards: sliceTextPage(textCards, options.limit, options.offset),
      matchType: textCards[options.offset]?.match_type ?? textCards[0]?.match_type ?? null,
      outcome: "text_fallback",
      fallbackReason: embed.reason,
      timings: { textMs, embedMs, vectorMs: 0, rankMs: 0 },
      textCount: textCards.length,
      visualCount: 0,
      cacheHit: embed.cacheHit,
      resultCacheHit: false,
      embedSource: embed.embedSource ?? "none",
      circuitState: embed.circuitState,
      liveEmbedToPersist: null,
    };
  }

  const embedSource: VisualEmbedSource =
    embed.embedSource ?? (embed.cacheHit ? "l1" : "gemini");
  const queryHash = embed.queryHash ?? visualQueryCacheKey(options.query, config);
  const liveEmbedToPersist: PersistableQueryEmbedPayload | null =
    embedSource === "gemini" && isPersistableSearchQuery(options.query)
      ? {
          query: options.query,
          queryHash,
          vector: embed.vector,
          config: {
            model: config.model,
            generation: config.generation,
            useTaskPrefix: config.useTaskPrefix,
          },
        }
      : null;

  const vectorStarted = performance.now();
  let visualCards: SearchVisualResult[] = [];
  try {
    visualCards = await options.deps.searchVisual(
      embed.vector,
      visualWindow,
      0,
      config.generation,
      options.filters,
      config.maxVisualDistance,
    );
  } catch {
    return {
      cards: sliceTextPage(textCards, options.limit, options.offset),
      matchType: textCards[options.offset]?.match_type ?? textCards[0]?.match_type ?? null,
      outcome: "text_fallback",
      fallbackReason: "provider_error",
      timings: {
        textMs,
        embedMs,
        vectorMs: performance.now() - vectorStarted,
        rankMs: 0,
      },
      textCount: textCards.length,
      visualCount: 0,
      cacheHit: embed.cacheHit,
      resultCacheHit: false,
      embedSource,
      circuitState: embed.circuitState,
      liveEmbedToPersist,
    };
  }
  const vectorMs = performance.now() - vectorStarted;

  // When maxVisualDistance is disabled (null) and ANN returns 0 rows, the index is empty -> fallback.
  // When maxVisualDistance is active, 0 visual rows means noise tail was cleanly filtered out -> merge cleanly.
  if (visualCards.length === 0 && config.maxVisualDistance === null) {
    return {
      cards: sliceTextPage(textCards, options.limit, options.offset),
      matchType: textCards[options.offset]?.match_type ?? textCards[0]?.match_type ?? null,
      outcome: "text_fallback",
      fallbackReason: "empty_visual",
      timings: { textMs, embedMs, vectorMs, rankMs: 0 },
      textCount: textCards.length,
      visualCount: 0,
      cacheHit: embed.cacheHit,
      resultCacheHit: false,
      embedSource,
      circuitState: embed.circuitState,
      liveEmbedToPersist,
    };
  }

  const rankStarted = performance.now();
  const merged = mergeHybridSearchResults({
    query: options.query,
    text: textCards as SearchRankCard[],
    visual: visualCards as SearchRankCard[],
    limit: options.limit,
    offset: options.offset,
  });
  const rankMs = performance.now() - rankStarted;

  return {
    cards: merged,
    matchType: merged[0]?.match_type ?? null,
    outcome: "hybrid",
    timings: { textMs, embedMs, vectorMs, rankMs },
    textCount: textCards.length,
    visualCount: visualCards.length,
    cacheHit: embed.cacheHit,
    resultCacheHit: false,
    embedSource,
    circuitState: embed.circuitState,
    liveEmbedToPersist,
  };
}

export async function runHybridCardSearch(options: {
  query: string;
  limit: number;
  offset: number;
  filters?: SearchCardFilters;
  headers: Headers;
  supabase: Parameters<typeof embedSearchQueryWithGuards>[0]["supabase"];
  deps: HybridSearchDeps;
  now?: Date;
  budgetActor?: VisualBudgetActor;
  /** Listing hybrid may raise this above TEXT_SEARCH_MAX_WINDOW. Public /search stays 100. */
  textMaxWindow?: number;
  /**
   * Listing cache-fill may wait longer than interactive `/api/search`.
   * Public search keeps `SEARCH_VISUAL_TIMEOUT_MS` (default 800).
   */
  embedTimeoutMs?: number;
  /**
   * Materializes up to 240 ranked cards into a 10-minute LRU cache so
   * `offset > 0` scroll pages resolve in <1ms without re-running SQL/ANN.
   */
  enableResultCache?: boolean;
}): Promise<HybridSearchResult> {
  const baseConfig = await resolveVisualSearchConfig(options.supabase);
  const config: VisualSearchConfig = options.embedTimeoutMs
    ? { ...baseConfig, timeoutMs: options.embedTimeoutMs }
    : baseConfig;

  const canUseResultCache =
    Boolean(options.enableResultCache) &&
    options.offset >= 0 &&
    options.offset + options.limit <= SEARCH_HYBRID_MATERIALIZE_LIMIT;

  if (!canUseResultCache) {
    return executeHybridCardSearchUncached({
      ...options,
      config,
    });
  }

  const cacheKey = buildResultCacheKey(options.query, options.filters, config);
  const cached = searchResultCache.get(cacheKey);
  if (cached) {
    const pageCards = sliceTextPage(cached.cards, options.limit, options.offset);
    return {
      cards: pageCards,
      matchType: pageCards[0]?.match_type ?? cached.matchType,
      outcome: cached.outcome,
      timings: emptyTimings(),
      textCount: cached.textCount,
      visualCount: cached.visualCount,
      cacheHit: true,
      resultCacheHit: true,
      embedSource: cached.embedSource,
      circuitState: "closed",
      liveEmbedToPersist: null,
    };
  }

  const materialized = await searchResultFlight.run(cacheKey, async () => {
    const replay = searchResultCache.get(cacheKey);
    if (replay) {
      return {
        cards: replay.cards,
        matchType: replay.matchType,
        outcome: replay.outcome,
        timings: emptyTimings(),
        textCount: replay.textCount,
        visualCount: replay.visualCount,
        cacheHit: true,
        resultCacheHit: true,
        embedSource: replay.embedSource,
        circuitState: "closed",
        liveEmbedToPersist: null,
      } satisfies HybridSearchResult;
    }

    const full = await executeHybridCardSearchUncached({
      ...options,
      limit: SEARCH_HYBRID_MATERIALIZE_LIMIT,
      offset: 0,
      config,
    });

    if (full.outcome !== "text_fallback") {
      searchResultCache.set(cacheKey, {
        cards: full.cards,
        matchType: full.matchType,
        outcome: full.outcome,
        textCount: full.textCount,
        visualCount: full.visualCount,
        embedSource: full.embedSource,
      });
    }

    return full;
  });

  const pageCards = sliceTextPage(
    materialized.cards,
    options.limit,
    options.offset,
  );
  return {
    ...materialized,
    cards: pageCards,
    matchType: pageCards[0]?.match_type ?? materialized.matchType,
  };
}
