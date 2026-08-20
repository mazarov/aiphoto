import {
  embedSearchQueryWithGuards,
  type VisualBudgetActor,
} from "@/lib/visual-search-guard";
import { mergeHybridSearchResults, type SearchRankCard } from "@/lib/visual-search-rank";
import {
  TEXT_SEARCH_MAX_WINDOW,
  VISUAL_SEARCH_RPC_MAX_WINDOW,
  getVisualSearchConfig,
  visualSearchWindowSize,
} from "@/lib/visual-search-config";
import type { SearchTextResult, SearchVisualResult } from "@/lib/supabase";

export type HybridSearchTimings = {
  textMs: number;
  embedMs: number;
  vectorMs: number;
  rankMs: number;
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
  circuitState: string;
};

export type HybridSearchDeps = {
  searchText: (query: string, limit: number, offset: number) => Promise<SearchTextResult[]>;
  searchVisual: (
    embedding: number[],
    limit: number,
    offset: number,
    generation?: number,
  ) => Promise<SearchVisualResult[]>;
  embedQuery: typeof embedSearchQueryWithGuards;
};

function sliceTextPage(
  cards: SearchTextResult[],
  limit: number,
  offset: number,
): SearchTextResult[] {
  return cards.slice(offset, offset + limit);
}

export async function runHybridCardSearch(options: {
  query: string;
  limit: number;
  offset: number;
  headers: Headers;
  supabase: Parameters<typeof embedSearchQueryWithGuards>[0]["supabase"];
  deps: HybridSearchDeps;
  now?: Date;
  budgetActor?: VisualBudgetActor;
}): Promise<HybridSearchResult> {
  const config = getVisualSearchConfig();
  const started = performance.now();
  const emptyTimings = (): HybridSearchTimings => ({
    textMs: 0,
    embedMs: 0,
    vectorMs: 0,
    rankMs: 0,
  });

  if (!config.enabled) {
    const cards = await options.deps.searchText(options.query, options.limit, options.offset);
    return {
      cards,
      matchType: cards[0]?.match_type ?? null,
      outcome: "text",
      timings: { ...emptyTimings(), textMs: performance.now() - started },
      textCount: cards.length,
      visualCount: 0,
      cacheHit: false,
      circuitState: "closed",
    };
  }

  const windowSize = visualSearchWindowSize(options.limit, options.offset);
  const textWindow = Math.min(TEXT_SEARCH_MAX_WINDOW, windowSize);
  const visualWindow = Math.min(VISUAL_SEARCH_RPC_MAX_WINDOW, windowSize);

  const textPromise = options.deps.searchText(options.query, textWindow, 0);
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
      circuitState: embed.circuitState,
    };
  }

  const vectorStarted = performance.now();
  let visualCards: SearchVisualResult[] = [];
  try {
    visualCards = await options.deps.searchVisual(
      embed.vector,
      visualWindow,
      0,
      config.generation,
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
      circuitState: embed.circuitState,
    };
  }
  const vectorMs = performance.now() - vectorStarted;

  if (visualCards.length === 0) {
    return {
      cards: sliceTextPage(textCards, options.limit, options.offset),
      matchType: textCards[options.offset]?.match_type ?? textCards[0]?.match_type ?? null,
      outcome: "text_fallback",
      fallbackReason: "empty_visual",
      timings: { textMs, embedMs, vectorMs, rankMs: 0 },
      textCount: textCards.length,
      visualCount: 0,
      cacheHit: embed.cacheHit,
      circuitState: embed.circuitState,
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
    circuitState: embed.circuitState,
  };
}
