import assert from "node:assert/strict";
import test from "node:test";
import { embeddingToRpcLiteral } from "./gemini-embedding";
import {
  collectStaticSearchSeedQueries,
  loadSearchQueryEmbedding,
  persistSearchQueryEmbedding,
  resetSearchQueryEmbeddingCacheStateForTests,
  warmPopularSearchQueryEmbeddings,
} from "./search-query-embedding-cache";
import {
  resetVisualSearchConfigCacheForTests,
  setVisualSearchFlagsForTests,
} from "./visual-search-config";
import { resetVisualSearchGuardsForTests, visualQueryCacheKey } from "./visual-search-guard";

const sampleVector = Array.from({ length: 768 }, (_, i) => (i % 10) * 0.01);

test("loadSearchQueryEmbedding and persistSearchQueryEmbedding round-trip 768-d vectors", async () => {
  const calls: Array<{ fn: string; args?: Record<string, unknown> }> = [];
  const supabase = {
    async rpc(fn: string, args?: Record<string, unknown>) {
      calls.push({ fn, args });
      if (fn === "get_search_query_embedding") {
        return { data: embeddingToRpcLiteral(sampleVector), error: null };
      }
      if (fn === "upsert_search_query_embedding") {
        return { data: true, error: null };
      }
      throw new Error(`unexpected ${fn}`);
    },
  };

  const loaded = await loadSearchQueryEmbedding({
    supabase,
    queryHash: "abc123",
  });
  assert.deepEqual(loaded, sampleVector);

  const saved = await persistSearchQueryEmbedding({
    supabase,
    query: "Чёрно-белое фото",
    queryHash: "abc123",
    vector: sampleVector,
    config: { model: "gemini-embedding-2", generation: 1, useTaskPrefix: true },
  });
  assert.equal(saved, true);
  assert.equal(calls[1]?.args?.p_query_norm, "черно-белое фото");
});

test("warmPopularSearchQueryEmbeddings warms missing seeds, popular analytics queries, refreshes clicks, and prunes at 03:00 UTC", async () => {
  resetVisualSearchConfigCacheForTests();
  resetVisualSearchGuardsForTests();
  resetSearchQueryEmbeddingCacheStateForTests();
  setVisualSearchFlagsForTests({ enabled: true, maxVisualDistance: 0.7 });
  const prevKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";

  const seeds = collectStaticSearchSeedQueries();
  assert.ok(seeds.length >= 6);

  const config = {
    model: "gemini-embedding-2",
    generation: 1,
    useTaskPrefix: true,
  };
  const prewarmedHashes = new Set(
    seeds.slice(1).map((seed) => visualQueryCacheKey(seed, config)),
  );
  const upsertedQueries: string[] = [];
  let refreshedClicks = false;
  let pruned = false;

  try {
    const summary = await warmPopularSearchQueryEmbeddings({
      now: new Date("2026-11-11T03:02:00.000Z"),
      limit: 5,
      embed: async () => sampleVector,
      supabase: {
        async rpc(fn: string, args?: Record<string, unknown>) {
          if (fn === "refresh_card_search_clicks_30d") {
            refreshedClicks = true;
            return { data: 14, error: null };
          }
          if (fn === "prune_search_query_embeddings") {
            pruned = true;
            return { data: 3, error: null };
          }
          if (fn === "get_search_query_embedding") {
            const hash = String(args?.p_query_hash ?? "");
            return {
              data: prewarmedHashes.has(hash)
                ? embeddingToRpcLiteral(sampleVector)
                : null,
              error: null,
            };
          }
          if (fn === "visual_search_rate_limit_increment") {
            return { data: { allowed: true }, error: null };
          }
          if (fn === "upsert_search_query_embedding") {
            upsertedQueries.push(String(args?.p_query_norm ?? ""));
            return { data: true, error: null };
          }
          if (fn === "list_uncached_popular_search_queries") {
            return {
              data: [
                { query_norm: "кот в ушанке", searches: 5, clicks: 2 },
                { query_norm: "девушка на яхте", searches: 3, clicks: 0 },
              ],
              error: null,
            };
          }
          throw new Error(`unexpected ${fn}`);
        },
      },
    });

    assert.equal(refreshedClicks, true);
    assert.equal(pruned, true);
    assert.equal(summary.clicksRefreshed, 14);
    assert.equal(summary.pruned, 3);
    assert.equal(summary.seedsPresent, seeds.length - 1);
    assert.equal(summary.seedsEmbedded, 1);
    assert.equal(summary.popularEmbedded, 2);
    assert.equal(summary.failed, 0);
    assert.deepEqual(upsertedQueries, [
      seeds[0]!,
      "кот в ушанке",
      "девушка на яхте",
    ]);
  } finally {
    process.env.GEMINI_API_KEY = prevKey;
    resetVisualSearchConfigCacheForTests();
    resetVisualSearchGuardsForTests();
    resetSearchQueryEmbeddingCacheStateForTests();
  }
});
