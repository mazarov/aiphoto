import assert from "node:assert/strict";
import test from "node:test";
import {
  SEARCH_VISUAL_ENABLED_CONFIG_KEY,
  SEARCH_VISUAL_MAX_DISTANCE_CONFIG_KEY,
  VISUAL_CONFIG_CACHE_TTL_MS,
  VISUAL_MAX_DISTANCE_DEFAULT,
  parseVisualEnabledFlag,
  parseVisualMaxDistanceFlag,
  resetVisualSearchConfigCacheForTests,
  resolveVisualSearchConfig,
} from "./visual-search-config";

test("parses DB visual flags and distance thresholds safely", () => {
  assert.equal(parseVisualEnabledFlag("true"), true);
  assert.equal(parseVisualEnabledFlag("1"), true);
  assert.equal(parseVisualEnabledFlag("false"), false);
  assert.equal(parseVisualEnabledFlag(""), false);

  assert.equal(parseVisualMaxDistanceFlag("0.68"), 0.68);
  assert.equal(parseVisualMaxDistanceFlag("0"), null);
  assert.equal(parseVisualMaxDistanceFlag("off"), null);
  assert.equal(parseVisualMaxDistanceFlag(""), null);
  assert.equal(parseVisualMaxDistanceFlag("invalid", 0.7), 0.7);
});

test("resolveVisualSearchConfig reads landing_generation_config and caches for 30s", async () => {
  resetVisualSearchConfigCacheForTests();
  let selects = 0;
  let dbEnabled = "true";
  let dbMaxDist = "0.65";

  const supabase = {
    async rpc() {
      return { data: null, error: null };
    },
    from(table: string) {
      assert.equal(table, "landing_generation_config");
      return {
        select() {
          return {
            async in(_col: string, keys: readonly string[]) {
              selects += 1;
              assert.deepEqual(keys, [
                SEARCH_VISUAL_ENABLED_CONFIG_KEY,
                SEARCH_VISUAL_MAX_DISTANCE_CONFIG_KEY,
              ]);
              return {
                data: [
                  { key: SEARCH_VISUAL_ENABLED_CONFIG_KEY, value: dbEnabled },
                  { key: SEARCH_VISUAL_MAX_DISTANCE_CONFIG_KEY, value: dbMaxDist },
                ],
                error: null,
              };
            },
          };
        },
      };
    },
  };

  try {
    const first = await resolveVisualSearchConfig(supabase, 1_000);
    assert.equal(first.enabled, true);
    assert.equal(first.maxVisualDistance, 0.65);
    assert.equal(selects, 1);

    dbEnabled = "false";
    const cached = await resolveVisualSearchConfig(supabase, 1_000 + 5_000);
    assert.equal(cached.enabled, true);
    assert.equal(selects, 1);

    // Force expiry past TTL
    const refreshed = await resolveVisualSearchConfig(
      supabase,
      1_000 + VISUAL_CONFIG_CACHE_TTL_MS + 1_000,
    );
    assert.equal(refreshed.enabled, false);
    assert.equal(selects, 2);
  } finally {
    resetVisualSearchConfigCacheForTests();
  }
});

test("resolveVisualSearchConfig defaults to disabled + default cutoff when DB has no rows", async () => {
  resetVisualSearchConfigCacheForTests();
  const supabase = {
    async rpc() {
      return { data: null, error: null };
    },
    from() {
      return {
        select() {
          return {
            async in() {
              return { data: [], error: null };
            },
          };
        },
      };
    },
  };

  try {
    const resolved = await resolveVisualSearchConfig(supabase);
    assert.equal(resolved.enabled, false);
    assert.equal(resolved.maxVisualDistance, VISUAL_MAX_DISTANCE_DEFAULT);
  } finally {
    resetVisualSearchConfigCacheForTests();
  }
});
