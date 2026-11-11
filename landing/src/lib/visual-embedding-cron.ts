import {
  warmPopularSearchQueryEmbeddings,
  type SearchQueryWarmSummary,
} from "@/lib/search-query-embedding-cache";
import { processVisualEmbeddingJobs } from "@/lib/visual-embedding-jobs";
import type { VisualRpcClient } from "@/lib/visual-search-config";

/** Cards claimed per tick. Matches `POST /api/cron/visual-embeddings` default. */
export const VISUAL_EMBEDDING_CRON_LIMIT = 8;
export const SEARCH_QUERY_WARM_CRON_LIMIT = 10;

/**
 * The YooKassa reconcile cron is the heartbeat that actually runs in production
 * (every minute). Embedding drain rides that tick on every 5th UTC minute.
 */
export function shouldDrainVisualEmbeddings(now = new Date()): boolean {
  return now.getUTCMinutes() % 5 === 0;
}

export async function drainVisualEmbeddingBacklog(options: {
  supabase: VisualRpcClient;
  limit?: number;
  queryWarmLimit?: number;
  now?: Date;
}): Promise<{
  claimed: number;
  completed: number;
  failed: number;
  errors: Record<string, number>;
  searchQueries: SearchQueryWarmSummary;
}> {
  const jobs = await processVisualEmbeddingJobs({
    supabase: options.supabase,
    limit: options.limit ?? VISUAL_EMBEDDING_CRON_LIMIT,
  });

  let searchQueries: SearchQueryWarmSummary = {
    seedsPresent: 0,
    seedsEmbedded: 0,
    popularEmbedded: 0,
    failed: 0,
    pruned: 0,
    clicksRefreshed: null,
  };
  try {
    searchQueries = await warmPopularSearchQueryEmbeddings({
      supabase: options.supabase,
      limit: options.queryWarmLimit ?? SEARCH_QUERY_WARM_CRON_LIMIT,
      now: options.now,
    });
  } catch (error) {
    console.warn("[visual-embeddings] search query warm failed", {
      message: error instanceof Error ? error.message.slice(0, 160) : String(error),
    });
  }

  return {
    ...jobs,
    searchQueries,
  };
}
