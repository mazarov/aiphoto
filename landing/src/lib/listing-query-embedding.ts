import {
  isBirthdayListingSearchQuery,
  birthdayListingSearchQueries,
  normalizeListingSearchQuery,
} from "@/lib/den-rozhdeniya-cluster";
import {
  assertEmbeddingVector,
  embeddingToRpcLiteral,
} from "@/lib/gemini-embedding";
import { LISTING_HYBRID_EMBED_TIMEOUT_MS } from "@/lib/listing-hybrid-search-timeout";
import {
  embedSearchQueryWithGuards,
  visualQueryCacheKey,
  type VisualEmbedOutcome,
} from "@/lib/visual-search-guard";
import {
  getVisualSearchConfig,
  type VisualRpcClient,
  type VisualSearchConfig,
} from "@/lib/visual-search-config";

function isMissingListingQueryRpc(message: string): boolean {
  return /Could not find the function|PGRST202|42883/i.test(message);
}

export function parseListingQueryEmbedding(raw: unknown): number[] | null {
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

export async function loadListingQueryEmbedding(options: {
  supabase: VisualRpcClient;
  query: string;
  config?: VisualSearchConfig;
}): Promise<number[] | null> {
  if (!isBirthdayListingSearchQuery(options.query)) return null;
  const config = options.config ?? getVisualSearchConfig();
  const queryHash = visualQueryCacheKey(options.query, config);
  try {
    const { data, error } = await options.supabase.rpc(
      "get_listing_query_embedding",
      { p_query_hash: queryHash },
    );
    if (error) {
      if (!isMissingListingQueryRpc(error.message)) {
        console.warn("[listing-query-embed] load failed", {
          message: error.message.slice(0, 160),
        });
      }
      return null;
    }
    return parseListingQueryEmbedding(data);
  } catch {
    return null;
  }
}

export async function persistListingQueryEmbedding(options: {
  supabase: VisualRpcClient;
  query: string;
  vector: number[];
  config?: VisualSearchConfig;
}): Promise<boolean> {
  if (!isBirthdayListingSearchQuery(options.query)) return false;
  const config = options.config ?? getVisualSearchConfig();
  try {
    const { error } = await options.supabase.rpc("upsert_listing_query_embedding", {
      p_query_hash: visualQueryCacheKey(options.query, config),
      p_query_norm: normalizeListingSearchQuery(options.query),
      p_model: config.model,
      p_generation: config.generation,
      p_use_task_prefix: config.useTaskPrefix,
      p_embedding: embeddingToRpcLiteral(options.vector),
    });
    if (error) {
      if (!isMissingListingQueryRpc(error.message)) {
        console.warn("[listing-query-embed] persist failed", {
          message: error.message.slice(0, 160),
        });
      }
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function embedListingSearchQuery(
  options: Parameters<typeof embedSearchQueryWithGuards>[0],
): Promise<VisualEmbedOutcome> {
  const config = options.config ?? getVisualSearchConfig();
  if (isBirthdayListingSearchQuery(options.query)) {
    const stored = await loadListingQueryEmbedding({
      supabase: options.supabase,
      query: options.query,
      config,
    });
    if (stored) {
      return {
        ok: true,
        vector: stored,
        cacheHit: true,
        circuitState: "closed",
      };
    }
  }

  const live = await embedSearchQueryWithGuards(options);
  if (live.ok && isBirthdayListingSearchQuery(options.query)) {
    await persistListingQueryEmbedding({
      supabase: options.supabase,
      query: options.query,
      vector: live.vector,
      config,
    });
  }
  return live;
}

export async function ensureBirthdayListingQueryEmbeddings(options: {
  supabase: VisualRpcClient;
  headers?: Headers;
  now?: Date;
  embed?: Parameters<typeof embedSearchQueryWithGuards>[0]["embed"];
}): Promise<{ present: number; embedded: number; failed: number }> {
  const config = {
    ...getVisualSearchConfig(),
    timeoutMs: LISTING_HYBRID_EMBED_TIMEOUT_MS,
  };
  const stats = { present: 0, embedded: 0, failed: 0 };
  if (!config.enabled) return stats;

  for (const query of birthdayListingSearchQueries()) {
    const stored = await loadListingQueryEmbedding({
      supabase: options.supabase,
      query,
      config,
    });
    if (stored) {
      stats.present += 1;
      continue;
    }

    const live = await embedSearchQueryWithGuards({
      query,
      headers: options.headers ?? new Headers(),
      supabase: options.supabase,
      config,
      now: options.now,
      budgetActor: "system",
      embed: options.embed,
    });
    if (!live.ok) {
      stats.failed += 1;
      continue;
    }
    const saved = await persistListingQueryEmbedding({
      supabase: options.supabase,
      query,
      vector: live.vector,
      config,
    });
    if (saved) stats.embedded += 1;
    else stats.failed += 1;
  }

  return stats;
}
