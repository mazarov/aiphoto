import { processVisualEmbeddingJobs } from "@/lib/visual-embedding-jobs";
import type { VisualRpcClient } from "@/lib/visual-search-config";

/** Cards claimed per tick. Matches `POST /api/cron/visual-embeddings` default. */
export const VISUAL_EMBEDDING_CRON_LIMIT = 8;

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
}): Promise<{
  claimed: number;
  completed: number;
  failed: number;
  errors: Record<string, number>;
}> {
  return processVisualEmbeddingJobs({
    supabase: options.supabase,
    limit: options.limit ?? VISUAL_EMBEDDING_CRON_LIMIT,
  });
}
