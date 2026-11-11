import { GENERACIYA_FOTO_SCENARIO_ROUTES } from "@/lib/generaciya-foto-routes";
import {
  assertEmbeddingVector,
  embeddingToRpcLiteral,
  type embedSearchQuery,
} from "@/lib/gemini-embedding";
import { LISTING_HYBRID_EMBED_TIMEOUT_MS } from "@/lib/listing-hybrid-search-timeout";
import {
  isPersistableSearchQuery,
  normalizeSearchQueryForCache,
} from "@/lib/search-query-normalize";
import { SEARCH_SUGGESTIONS } from "@/lib/search-suggestions";
import {
  resolveVisualSearchConfig,
  type VisualRpcClient,
  type VisualSearchConfig,
} from "@/lib/visual-search-config";

export const POPULAR_QUERY_WARM_DAYS = 7;
export const POPULAR_QUERY_WARM_MIN_SEARCHES = 2;
export const POPULAR_QUERY_WARM_LIMIT_DEFAULT = 10;
export const QUERY_EMBEDDING_PRUNE_DAYS = 90;

let warmedStaticSeedsSignature: string | null = null;

export function resetSearchQueryEmbeddingCacheStateForTests(): void {
  warmedStaticSeedsSignature = null;
}

function isMissingSearchQueryRpc(message: string): boolean {
  return /Could not find the function|PGRST202|42883|does not exist/i.test(message);
}

export function parseStoredSearchQueryEmbedding(raw: unknown): number[] | null {
  if (raw == null || raw === "") return null;
  let values: unknown = raw;
  if (typeof raw === "string") {
    try {
      values = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  try {
    return assertEmbeddingVector(values);
  } catch {
    return null;
  }
}

export async function loadSearchQueryEmbedding(options: {
  supabase: VisualRpcClient;
  queryHash: string;
}): Promise<number[] | null> {
  if (!options.queryHash) return null;
  try {
    const { data, error } = await options.supabase.rpc(
      "get_search_query_embedding",
      { p_query_hash: options.queryHash },
    );
    if (error) {
      if (!isMissingSearchQueryRpc(error.message)) {
        console.warn("[search-query-embed] load failed", {
          message: error.message.slice(0, 160),
        });
      }
      return null;
    }
    return parseStoredSearchQueryEmbedding(data);
  } catch {
    return null;
  }
}

export async function persistSearchQueryEmbedding(options: {
  supabase: VisualRpcClient;
  query: string;
  queryHash: string;
  vector: number[];
  config: Pick<VisualSearchConfig, "model" | "generation" | "useTaskPrefix">;
}): Promise<boolean> {
  if (!isPersistableSearchQuery(options.query)) return false;
  const queryNorm = normalizeSearchQueryForCache(options.query);
  if (!queryNorm || !options.queryHash) return false;

  try {
    const { error } = await options.supabase.rpc(
      "upsert_search_query_embedding",
      {
        p_query_hash: options.queryHash,
        p_query_norm: queryNorm,
        p_model: options.config.model,
        p_generation: options.config.generation,
        p_use_task_prefix: options.config.useTaskPrefix,
        p_embedding: embeddingToRpcLiteral(options.vector),
      },
    );
    if (error) {
      if (!isMissingSearchQueryRpc(error.message)) {
        console.warn("[search-query-embed] persist failed", {
          message: error.message.slice(0, 160),
        });
      }
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[search-query-embed] persist threw", {
      message: err instanceof Error ? err.message.slice(0, 160) : String(err),
    });
    return false;
  }
}

export function collectStaticSearchSeedQueries(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const candidates = [
    ...SEARCH_SUGGESTIONS,
    ...GENERACIYA_FOTO_SCENARIO_ROUTES.map((route) => route.label),
  ];

  for (const raw of candidates) {
    const norm = normalizeSearchQueryForCache(raw);
    if (!isPersistableSearchQuery(norm) || seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
  }
  return out;
}

type UncachedQueryRow = {
  query_norm?: unknown;
};

export type SearchQueryWarmSummary = {
  seedsPresent: number;
  seedsEmbedded: number;
  popularEmbedded: number;
  failed: number;
  pruned: number;
  clicksRefreshed: number | null;
};

export function shouldPruneSearchQueryEmbeddings(now = new Date()): boolean {
  return now.getUTCHours() === 3 && now.getUTCMinutes() < 5;
}

export function shouldRefreshSearchClicks30d(now = new Date()): boolean {
  return now.getUTCMinutes() < 5;
}

export async function warmPopularSearchQueryEmbeddings(options: {
  supabase: VisualRpcClient;
  limit?: number;
  now?: Date;
  embed?: typeof embedSearchQuery;
  forceSeeds?: boolean;
}): Promise<SearchQueryWarmSummary> {
  const { embedSearchQueryWithGuards, visualQueryCacheKey } = await import(
    "@/lib/visual-search-guard"
  );
  const now = options.now ?? new Date();
  const baseConfig = await resolveVisualSearchConfig(options.supabase);
  const config: VisualSearchConfig = {
    ...baseConfig,
    timeoutMs: LISTING_HYBRID_EMBED_TIMEOUT_MS,
  };

  const summary: SearchQueryWarmSummary = {
    seedsPresent: 0,
    seedsEmbedded: 0,
    popularEmbedded: 0,
    failed: 0,
    pruned: 0,
    clicksRefreshed: null,
  };

  if (shouldRefreshSearchClicks30d(now)) {
    try {
      const { data, error } = await options.supabase.rpc(
        "refresh_card_search_clicks_30d",
      );
      if (!error && typeof data === "number") {
        summary.clicksRefreshed = data;
      }
    } catch {
      // Non-fatal maintenance RPC.
    }
  }

  if (shouldPruneSearchQueryEmbeddings(now)) {
    try {
      const { data, error } = await options.supabase.rpc(
        "prune_search_query_embeddings",
        { p_older_than_days: QUERY_EMBEDDING_PRUNE_DAYS },
      );
      if (!error && typeof data === "number") {
        summary.pruned = data;
      }
    } catch {
      // Non-fatal maintenance RPC.
    }
  }

  if (!config.enabled) {
    return summary;
  }

  const seedSig = `${config.model}:${config.generation}:${config.useTaskPrefix ? "1" : "0"}`;
  if (options.forceSeeds || warmedStaticSeedsSignature !== seedSig) {
    const seeds = collectStaticSearchSeedQueries();
    let allSeedsReady = true;

    for (const seedQuery of seeds) {
      const queryHash = visualQueryCacheKey(seedQuery, config);
      const existing = await loadSearchQueryEmbedding({
        supabase: options.supabase,
        queryHash,
      });
      if (existing) {
        summary.seedsPresent += 1;
        continue;
      }

      const live = await embedSearchQueryWithGuards({
        query: seedQuery,
        headers: new Headers(),
        supabase: options.supabase,
        config,
        now,
        budgetActor: "system",
        skipPersistentLookup: true,
        embed: options.embed,
      });
      if (!live.ok) {
        summary.failed += 1;
        allSeedsReady = false;
        continue;
      }

      const saved = await persistSearchQueryEmbedding({
        supabase: options.supabase,
        query: seedQuery,
        queryHash,
        vector: live.vector,
        config,
      });
      if (saved) {
        summary.seedsEmbedded += 1;
      } else {
        summary.failed += 1;
        allSeedsReady = false;
      }
    }

    if (allSeedsReady) {
      warmedStaticSeedsSignature = seedSig;
    }
  }

  const popularLimit = Math.max(
    1,
    Math.min(50, options.limit ?? POPULAR_QUERY_WARM_LIMIT_DEFAULT),
  );
  try {
    const { data, error } = await options.supabase.rpc(
      "list_uncached_popular_search_queries",
      {
        p_days: POPULAR_QUERY_WARM_DAYS,
        p_min_searches: POPULAR_QUERY_WARM_MIN_SEARCHES,
        p_model: config.model,
        p_generation: config.generation,
        p_use_task_prefix: config.useTaskPrefix,
        p_limit: popularLimit,
      },
    );
    if (error) {
      if (!isMissingSearchQueryRpc(error.message)) {
        console.warn("[search-query-embed] list popular failed", {
          message: error.message.slice(0, 160),
        });
      }
      return summary;
    }

    const rows = Array.isArray(data) ? (data as UncachedQueryRow[]) : [];
    for (const row of rows) {
      const queryNorm =
        typeof row?.query_norm === "string"
          ? normalizeSearchQueryForCache(row.query_norm)
          : "";
      if (!isPersistableSearchQuery(queryNorm)) continue;

      const queryHash = visualQueryCacheKey(queryNorm, config);
      const live = await embedSearchQueryWithGuards({
        query: queryNorm,
        headers: new Headers(),
        supabase: options.supabase,
        config,
        now,
        budgetActor: "system",
        skipPersistentLookup: true,
        embed: options.embed,
      });
      if (!live.ok) {
        summary.failed += 1;
        continue;
      }

      const saved = await persistSearchQueryEmbedding({
        supabase: options.supabase,
        query: queryNorm,
        queryHash,
        vector: live.vector,
        config,
      });
      if (saved) {
        summary.popularEmbedded += 1;
      } else {
        summary.failed += 1;
      }
    }
  } catch (err) {
    console.warn("[search-query-embed] popular warm threw", {
      message: err instanceof Error ? err.message.slice(0, 160) : String(err),
    });
  }

  return summary;
}
