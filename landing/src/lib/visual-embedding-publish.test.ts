import assert from "node:assert/strict";
import test from "node:test";
import { processPublishedCardEmbedding } from "./visual-embedding-publish";

test("publish kick enqueues the card before processing one job", async () => {
  const rpcCalls: Array<{
    fn: string;
    args?: Record<string, unknown>;
  }> = [];
  let processLimit = 0;
  const supabase = {
    async rpc(fn: string, args?: Record<string, unknown>) {
      rpcCalls.push({ fn, args });
      return { data: "job-id", error: null };
    },
  };

  const result = await processPublishedCardEmbedding({
    supabase,
    cardId: "card-1",
    processJobs: async (options) => {
      processLimit = options.limit ?? 0;
      return {
        claimed: 1,
        completed: 1,
        failed: 0,
        errors: {},
      };
    },
  });

  assert.deepEqual(rpcCalls, [
    {
      fn: "enqueue_canonical_visual_embedding_job",
      args: { p_card_id: "card-1", p_generation: null },
    },
  ]);
  assert.equal(processLimit, 1);
  assert.equal(result.completed, 1);
});

test("publish kick does not claim jobs when enqueue fails", async () => {
  let processed = false;

  await assert.rejects(
    processPublishedCardEmbedding({
      supabase: {
        async rpc() {
          return { data: null, error: { message: "enqueue_failed" } };
        },
      },
      cardId: "card-1",
      processJobs: async () => {
        processed = true;
        return {
          claimed: 0,
          completed: 0,
          failed: 0,
          errors: {},
        };
      },
    }),
    /enqueue_failed/,
  );

  assert.equal(processed, false);
});
