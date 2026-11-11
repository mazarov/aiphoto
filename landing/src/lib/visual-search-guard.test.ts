import assert from "node:assert/strict";
import test from "node:test";
import { extensionRateLimitIpHash } from "./extension-rate-limit-ip";
import { embeddingToRpcLiteral } from "./gemini-embedding";
import {
  embedSearchQueryWithGuards,
  reserveVisualSearchBudget,
  resetVisualSearchGuardsForTests,
  visualQueryCacheKey,
} from "./visual-search-guard";
import {
  VISUAL_BUDGET_SYSTEM_IP,
  VISUAL_SYSTEM_DAILY_LIMIT_DEFAULT,
  getVisualSearchConfig,
  resetVisualSearchConfigCacheForTests,
  setVisualSearchFlagsForTests,
} from "./visual-search-config";

function supabaseAllowed() {
  return {
    async rpc(fn: string) {
      if (fn === "get_search_query_embedding") {
        return { data: null, error: null };
      }
      return { data: { allowed: true, ip_count: 1, global_count: 1 }, error: null };
    },
  };
}

test("guard skips Gemini when visual search is disabled in DB config", async () => {
  resetVisualSearchGuardsForTests();
  resetVisualSearchConfigCacheForTests();
  setVisualSearchFlagsForTests({ enabled: false });
  try {
    const result = await embedSearchQueryWithGuards({
      query: "неон",
      headers: new Headers({ "x-forwarded-for": "203.0.113.10" }),
      supabase: supabaseAllowed(),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "disabled");
  } finally {
    resetVisualSearchConfigCacheForTests();
  }
});

test("guard denies visual branch when L2 misses and budget RPC is unavailable", async () => {
  resetVisualSearchGuardsForTests();
  resetVisualSearchConfigCacheForTests();
  setVisualSearchFlagsForTests({ enabled: true });
  const prevKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
  try {
    const result = await embedSearchQueryWithGuards({
      query: "неон",
      headers: new Headers({ "x-forwarded-for": "203.0.113.10" }),
      supabase: {
        async rpc(fn: string) {
          if (fn === "get_search_query_embedding") {
            return { data: null, error: null };
          }
          return { data: null, error: { message: "down" } };
        },
      },
      embed: async () => {
        throw new Error("should not embed");
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "guard_unavailable");
  } finally {
    process.env.GEMINI_API_KEY = prevKey;
    resetVisualSearchConfigCacheForTests();
  }
});

test("guard hits L2 Postgres cache without spending budget or requiring GEMINI_API_KEY, then promotes to L1", async () => {
  resetVisualSearchGuardsForTests();
  resetVisualSearchConfigCacheForTests();
  setVisualSearchFlagsForTests({ enabled: true });
  const prevKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "";
  const storedVector = Array.from({ length: 768 }, () => 0.02);
  const rpcCalls: string[] = [];

  try {
    const supabase = {
      async rpc(fn: string) {
        rpcCalls.push(fn);
        if (fn === "get_search_query_embedding") {
          return { data: embeddingToRpcLiteral(storedVector), error: null };
        }
        throw new Error(`unexpected ${fn}`);
      },
    };

    const first = await embedSearchQueryWithGuards({
      query: "Чёрно-белое фото",
      headers: new Headers({ "x-forwarded-for": "203.0.113.10" }),
      supabase,
      embed: async () => {
        throw new Error("should not call Gemini");
      },
    });
    assert.equal(first.ok, true);
    if (first.ok) {
      assert.equal(first.embedSource, "l2_db");
      assert.equal(first.cacheHit, true);
      assert.deepEqual(first.vector, storedVector);
    }
    assert.deepEqual(rpcCalls, ["get_search_query_embedding"]);

    // Second call with `е` instead of `ё` hits L1 RAM cache directly (0 RPC calls).
    const second = await embedSearchQueryWithGuards({
      query: "черно-белое фото",
      headers: new Headers({ "x-forwarded-for": "203.0.113.10" }),
      supabase,
      embed: async () => {
        throw new Error("should not call Gemini");
      },
    });
    assert.equal(second.ok, true);
    if (second.ok) {
      assert.equal(second.embedSource, "l1");
      assert.equal(second.cacheHit, true);
    }
    assert.deepEqual(rpcCalls, ["get_search_query_embedding"]);
  } finally {
    process.env.GEMINI_API_KEY = prevKey;
    resetVisualSearchConfigCacheForTests();
    resetVisualSearchGuardsForTests();
  }
});

test("guard caches a successful live Gemini query embedding in L1", async () => {
  resetVisualSearchGuardsForTests();
  resetVisualSearchConfigCacheForTests();
  setVisualSearchFlagsForTests({ enabled: true });
  const prevKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
  let embeds = 0;
  const vector = Array.from({ length: 768 }, () => 0.01);
  try {
    const first = await embedSearchQueryWithGuards({
      query: "неон",
      headers: new Headers({ "x-forwarded-for": "203.0.113.10" }),
      supabase: supabaseAllowed(),
      embed: async () => {
        embeds += 1;
        return vector;
      },
    });
    const second = await embedSearchQueryWithGuards({
      query: "неон",
      headers: new Headers({ "x-forwarded-for": "203.0.113.10" }),
      supabase: supabaseAllowed(),
      embed: async () => {
        embeds += 1;
        return vector;
      },
    });
    assert.equal(first.ok, true);
    if (first.ok) assert.equal(first.embedSource, "gemini");
    assert.equal(second.ok, true);
    if (second.ok) {
      assert.equal(second.cacheHit, true);
      assert.equal(second.embedSource, "l1");
    }
    assert.equal(embeds, 1);
  } finally {
    process.env.GEMINI_API_KEY = prevKey;
    resetVisualSearchConfigCacheForTests();
    resetVisualSearchGuardsForTests();
  }
});

test("visualQueryCacheKey folds yo-to-e identically", () => {
  const cfg = getVisualSearchConfig();
  assert.equal(
    visualQueryCacheKey("Девушка под ёлкой", cfg),
    visualQueryCacheKey("девушка под елкой", cfg),
  );
});

test("system budget actor does not share the request IP bucket", async () => {
  resetVisualSearchConfigCacheForTests();
  setVisualSearchFlagsForTests({ enabled: true });
  try {
    const now = new Date("2026-08-20T07:00:00.000Z");
    let ipHash = "";
    let ipMax = 0;
    const result = await reserveVisualSearchBudget({
      headers: new Headers({ "x-forwarded-for": "203.0.113.10" }),
      budgetActor: "system",
      now,
      supabase: {
        async rpc(_fn, args) {
          ipHash = String(args?.p_ip_hash ?? "");
          ipMax = Number(args?.p_ip_max ?? 0);
          return { data: { allowed: true }, error: null };
        },
      },
    });
    assert.equal(result.allowed, true);
    assert.equal(ipHash, extensionRateLimitIpHash(VISUAL_BUDGET_SYSTEM_IP, now));
    assert.notEqual(ipHash, extensionRateLimitIpHash("203.0.113.10", now));
    assert.equal(ipMax, VISUAL_SYSTEM_DAILY_LIMIT_DEFAULT);
  } finally {
    resetVisualSearchConfigCacheForTests();
  }
});
