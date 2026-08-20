import assert from "node:assert/strict";
import test from "node:test";
import { extensionRateLimitIpHash } from "./extension-rate-limit-ip";
import {
  embedSearchQueryWithGuards,
  reserveVisualSearchBudget,
  resetVisualSearchGuardsForTests,
} from "./visual-search-guard";
import { VISUAL_BUDGET_SYSTEM_IP, VISUAL_SYSTEM_DAILY_LIMIT_DEFAULT } from "./visual-search-config";

function supabaseAllowed() {
  return {
    async rpc() {
      return { data: { allowed: true, ip_count: 1, global_count: 1 }, error: null };
    },
  };
}

test("guard skips Gemini when visual search is disabled", async () => {
  resetVisualSearchGuardsForTests();
  const previous = process.env.SEARCH_VISUAL_ENABLED;
  process.env.SEARCH_VISUAL_ENABLED = "0";
  try {
    const result = await embedSearchQueryWithGuards({
      query: "неон",
      headers: new Headers({ "x-forwarded-for": "203.0.113.10" }),
      supabase: supabaseAllowed(),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "disabled");
  } finally {
    process.env.SEARCH_VISUAL_ENABLED = previous;
  }
});

test("guard denies visual branch when the budget RPC is unavailable", async () => {
  resetVisualSearchGuardsForTests();
  const prevEnabled = process.env.SEARCH_VISUAL_ENABLED;
  const prevKey = process.env.GEMINI_API_KEY;
  process.env.SEARCH_VISUAL_ENABLED = "1";
  process.env.GEMINI_API_KEY = "test-key";
  try {
    const result = await embedSearchQueryWithGuards({
      query: "неон",
      headers: new Headers({ "x-forwarded-for": "203.0.113.10" }),
      supabase: {
        async rpc() {
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
    process.env.SEARCH_VISUAL_ENABLED = prevEnabled;
    process.env.GEMINI_API_KEY = prevKey;
  }
});

test("guard caches a successful query embedding", async () => {
  resetVisualSearchGuardsForTests();
  const prevEnabled = process.env.SEARCH_VISUAL_ENABLED;
  const prevKey = process.env.GEMINI_API_KEY;
  process.env.SEARCH_VISUAL_ENABLED = "1";
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
    assert.equal(second.ok, true);
    if (second.ok) assert.equal(second.cacheHit, true);
    assert.equal(embeds, 1);
  } finally {
    process.env.SEARCH_VISUAL_ENABLED = prevEnabled;
    process.env.GEMINI_API_KEY = prevKey;
    resetVisualSearchGuardsForTests();
  }
});

test("system budget actor does not share the request IP bucket", async () => {
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
});
