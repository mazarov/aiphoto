import { processVisualEmbeddingJobs } from "@/lib/visual-embedding-jobs";
import type { VisualRpcClient } from "@/lib/visual-search-config";

type ProcessJobs = typeof processVisualEmbeddingJobs;

export async function processPublishedCardEmbedding(options: {
  supabase: VisualRpcClient;
  cardId: string;
  processJobs?: ProcessJobs;
}) {
  const { error } = await options.supabase.rpc(
    "enqueue_canonical_visual_embedding_job",
    {
      p_card_id: options.cardId,
      p_generation: null,
    },
  );
  if (error) throw new Error(error.message);

  return (options.processJobs ?? processVisualEmbeddingJobs)({
    supabase: options.supabase,
    limit: 1,
  });
}
