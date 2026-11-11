import assert from "node:assert/strict";
import test from "node:test";
import { embeddingToRpcLiteral } from "./gemini-embedding";
import {
  embedListingSearchQuery,
  ensureBirthdayListingQueryEmbeddings,
  loadListingQueryEmbedding,
  parseListingQueryEmbedding,
  persistListingQueryEmbedding,
} from "./listing-query-embedding";
import {
  resetVisualSearchGuardsForTests,
  visualQueryCacheKey,
} from "./visual-search-guard";
import {
  getVisualSearchConfig,
  resetVisualSearchConfigCacheForTests,
  setVisualSearchFlagsForTests,
} from "./visual-search-config";

const storedVector = Array.from({ length: 768 }, (_, index) => index * 0.001);

function rpcClient(handler: (fn: string, args?: Record<string, unknown>) => Promise<{
  data: unknown;
  error: { message: string } | null;
}>) {
  return {
    async rpc(fn: string, args?: Record<string, unknown>) {
      return handler(fn, args);
    },
  };
}

test("parseListingQueryEmbedding accepts Postgres vector text", () => {
  assert.deepEqual(
    parseListingQueryEmbedding(embeddingToRpcLiteral(storedVector)),
    storedVector,
  );
  assert.equal(parseListingQueryEmbedding(null), null);
  assert.equal(parseListingQueryEmbedding("[1,2]"), null);
});

test("loadListingQueryEmbedding ignores non-SSOT queries and missing RPC", async () => {
  resetVisualSearchConfigCacheForTests();
  setVisualSearchFlagsForTests({ enabled: true });
  try {
    const calls: string[] = [];
    const supabase = rpcClient(async (fn) => {
      calls.push(fn);
      return { data: null, error: { message: "Could not find the function" } };
    });
    assert.equal(
      await loadListingQueryEmbedding({
        supabase,
        query: "ночной портрет",
      }),
      null,
    );
    assert.deepEqual(calls, []);
    assert.equal(
      await loadListingQueryEmbedding({
        supabase,
        query: "мужской день рождения",
      }),
      null,
    );
    assert.deepEqual(calls, ["get_listing_query_embedding"]);
  } finally {
    resetVisualSearchConfigCacheForTests();
  }
});

test("loadListingQueryEmbedding returns a stored SSOT vector", async () => {
  resetVisualSearchConfigCacheForTests();
  setVisualSearchFlagsForTests({ enabled: true });
  try {
    const supabase = rpcClient(async (fn, args) => {
      assert.equal(fn, "get_listing_query_embedding");
      assert.equal(
        args?.p_query_hash,
        visualQueryCacheKey("мужской день рождения", getVisualSearchConfig()),
      );
      return { data: embeddingToRpcLiteral(storedVector), error: null };
    });
    assert.deepEqual(
      await loadListingQueryEmbedding({
        supabase,
        query: "мужской день рождения",
      }),
      storedVector,
    );
  } finally {
    resetVisualSearchConfigCacheForTests();
  }
});

test("persistListingQueryEmbedding writes only SSOT queries", async () => {
  resetVisualSearchConfigCacheForTests();
  setVisualSearchFlagsForTests({ enabled: true });
  try {
    const calls: string[] = [];
    const supabase = rpcClient(async (fn) => {
      calls.push(fn);
      return { data: true, error: null };
    });
    assert.equal(
      await persistListingQueryEmbedding({
        supabase,
        query: "ночной портрет",
        vector: storedVector,
      }),
      false,
    );
    assert.deepEqual(calls, []);
    assert.equal(
      await persistListingQueryEmbedding({
        supabase,
        query: "со львом",
        vector: storedVector,
      }),
      true,
    );
    assert.deepEqual(calls, ["upsert_listing_query_embedding"]);
  } finally {
    resetVisualSearchConfigCacheForTests();
  }
});

test("embedListingSearchQuery skips Gemini when the vector is stored", async () => {
  resetVisualSearchConfigCacheForTests();
  setVisualSearchFlagsForTests({ enabled: true });
  const calls: string[] = [];
  try {
    const result = await embedListingSearchQuery({
      query: "с шампанским",
      headers: new Headers(),
      supabase: rpcClient(async (fn) => {
        calls.push(fn);
        if (fn === "get_listing_query_embedding") {
          return { data: embeddingToRpcLiteral(storedVector), error: null };
        }
        throw new Error(`unexpected ${fn}`);
      }),
      embed: async () => {
        throw new Error("should not embed");
      },
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.vector, storedVector);
      assert.equal(result.embedSource, "l2_db");
    }
    assert.equal(result.cacheHit, true);
    assert.deepEqual(calls, ["get_listing_query_embedding"]);
  } finally {
    resetVisualSearchConfigCacheForTests();
  }
});

test("embedListingSearchQuery persists a live SSOT embed", async () => {
  resetVisualSearchConfigCacheForTests();
  setVisualSearchFlagsForTests({ enabled: true });
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
  resetVisualSearchGuardsForTests();
  const calls: string[] = [];
  try {
    const result = await embedListingSearchQuery({
      query: "день рождения с детским фото",
      headers: new Headers(),
      supabase: rpcClient(async (fn) => {
        calls.push(fn);
        if (fn === "get_listing_query_embedding") {
          return { data: null, error: null };
        }
        if (fn === "visual_search_rate_limit_increment") {
          return { data: { allowed: true }, error: null };
        }
        if (fn === "upsert_listing_query_embedding") {
          return { data: true, error: null };
        }
        throw new Error(`unexpected ${fn}`);
      }),
      embed: async () => storedVector,
    });
    assert.equal(result.ok, true);
    assert.deepEqual(calls, [
      "get_listing_query_embedding",
      "visual_search_rate_limit_increment",
      "upsert_listing_query_embedding",
    ]);
  } finally {
    process.env.GEMINI_API_KEY = previousKey;
    resetVisualSearchConfigCacheForTests();
    resetVisualSearchGuardsForTests();
  }
});

test("ensureBirthdayListingQueryEmbeddings embeds only missing SSOT rows", async () => {
  resetVisualSearchConfigCacheForTests();
  setVisualSearchFlagsForTests({ enabled: true });
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
  resetVisualSearchGuardsForTests();
  let embeds = 0;
  let upserts = 0;
  try {
    const stats = await ensureBirthdayListingQueryEmbeddings({
      supabase: rpcClient(async (fn, args) => {
        if (fn === "get_listing_query_embedding") {
          const manHash = visualQueryCacheKey(
            "мужской день рождения",
            getVisualSearchConfig(),
          );
          if (args?.p_query_hash === manHash) {
            return { data: embeddingToRpcLiteral(storedVector), error: null };
          }
          return { data: null, error: null };
        }
        if (fn === "visual_search_rate_limit_increment") {
          return { data: { allowed: true }, error: null };
        }
        if (fn === "upsert_listing_query_embedding") {
          upserts += 1;
          return { data: true, error: null };
        }
        throw new Error(`unexpected ${fn}`);
      }),
      headers: new Headers(),
      embed: async () => {
        embeds += 1;
        return storedVector;
      },
    });
    assert.deepEqual(stats, { present: 1, embedded: 4, failed: 0 });
    assert.equal(embeds, 4);
    assert.equal(upserts, 4);
  } finally {
    process.env.GEMINI_API_KEY = previousKey;
    resetVisualSearchConfigCacheForTests();
    resetVisualSearchGuardsForTests();
  }
});
