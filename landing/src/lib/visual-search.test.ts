import assert from "node:assert/strict";
import test from "node:test";
import {
  resetHybridSearchResultCacheForTests,
  runHybridCardSearch,
} from "./visual-search";
import {
  resetVisualSearchConfigCacheForTests,
  setVisualSearchFlagsForTests,
} from "./visual-search-config";

const textCard = {
  id: "text-1",
  slug: "text-1",
  title_ru: "ночной портрет",
  title_en: null,
  seo_tags: null,
  relevance_score: 400,
  match_type: "fts",
};

const visualCard = {
  id: "visual-1",
  slug: "visual-1",
  title_ru: "неон",
  title_en: null,
  seo_tags: null,
  relevance_score: 800,
  match_type: "visual",
  visual_distance: 0.1,
  source_date: "2026-01-01T00:00:00.000Z",
};

test("hybrid search falls back to text when embedding is denied", async () => {
  resetHybridSearchResultCacheForTests();
  resetVisualSearchConfigCacheForTests();
  setVisualSearchFlagsForTests({ enabled: true, maxVisualDistance: 0.7 });
  try {
    const result = await runHybridCardSearch({
      query: "ночной портрет",
      limit: 10,
      offset: 0,
      headers: new Headers(),
      supabase: { async rpc() { return { data: null, error: null }; } },
      deps: {
        searchText: async () => [textCard],
        searchVisual: async () => {
          throw new Error("should not search visual");
        },
        embedQuery: async () => ({
          ok: false,
          reason: "timeout",
          cacheHit: false,
          embedSource: "none",
          circuitState: "open",
        }),
      },
    });
    assert.equal(result.outcome, "text_fallback");
    assert.equal(result.fallbackReason, "timeout");
    assert.deepEqual(result.cards.map((card) => card.id), ["text-1"]);
  } finally {
    resetVisualSearchConfigCacheForTests();
    resetHybridSearchResultCacheForTests();
  }
});

test("hybrid search keeps the interactive embed timeout unless listing overrides it", async () => {
  resetHybridSearchResultCacheForTests();
  resetVisualSearchConfigCacheForTests();
  setVisualSearchFlagsForTests({ enabled: true, maxVisualDistance: 0.7 });
  let seenTimeout: number | undefined;
  try {
    await runHybridCardSearch({
      query: "ночной портрет",
      limit: 10,
      offset: 0,
      headers: new Headers(),
      supabase: { async rpc() { return { data: null, error: null }; } },
      embedTimeoutMs: 8000,
      deps: {
        searchText: async () => [textCard],
        searchVisual: async () => [visualCard],
        embedQuery: async (options) => {
          seenTimeout = options.config?.timeoutMs;
          return {
            ok: true,
            vector: Array.from({ length: 768 }, () => 0.01),
            cacheHit: false,
            embedSource: "gemini",
            queryHash: "hash-1",
            circuitState: "closed",
          };
        },
      },
    });
    assert.equal(seenTimeout, 8000);
  } finally {
    resetVisualSearchConfigCacheForTests();
    resetHybridSearchResultCacheForTests();
  }
});

test("hybrid search merges visual candidates, forwards synonymQuery + maxVisualDistance, and emits liveEmbedToPersist", async () => {
  resetHybridSearchResultCacheForTests();
  resetVisualSearchConfigCacheForTests();
  setVisualSearchFlagsForTests({ enabled: true, maxVisualDistance: 0.68 });
  let seenSynonym: string | null | undefined;
  let seenMaxDist: number | null | undefined;
  try {
    const result = await runHybridCardSearch({
      query: "чб портрет",
      limit: 10,
      offset: 0,
      headers: new Headers(),
      supabase: { async rpc() { return { data: null, error: null }; } },
      deps: {
        searchText: async (_q, _limit, _offset, _filters, synonymQuery) => {
          seenSynonym = synonymQuery;
          return [textCard];
        },
        searchVisual: async (_emb, _limit, _offset, _gen, _filters, maxDistance) => {
          seenMaxDist = maxDistance;
          return [visualCard];
        },
        embedQuery: async () => ({
          ok: true,
          vector: Array.from({ length: 768 }, () => 0.01),
          cacheHit: false,
          embedSource: "gemini",
          queryHash: "hash-chb",
          circuitState: "closed",
        }),
      },
    });
    assert.equal(result.outcome, "hybrid");
    assert.equal(seenSynonym, "черно-белое портрет");
    assert.equal(seenMaxDist, 0.68);
    assert.equal(result.liveEmbedToPersist?.queryHash, "hash-chb");
    assert.equal(result.cards[0]?.id, "text-1");
    assert.equal(result.cards.some((card) => card.id === "visual-1"), true);
  } finally {
    resetVisualSearchConfigCacheForTests();
    resetHybridSearchResultCacheForTests();
  }
});

test("active maxVisualDistance cleanly returns empty or text-only results without false text_fallback", async () => {
  resetHybridSearchResultCacheForTests();
  resetVisualSearchConfigCacheForTests();
  setVisualSearchFlagsForTests({ enabled: true, maxVisualDistance: 0.7 });
  try {
    const zeroHit = await runHybridCardSearch({
      query: "несуществующий артикул",
      limit: 24,
      offset: 0,
      headers: new Headers(),
      supabase: { async rpc() { return { data: null, error: null }; } },
      deps: {
        searchText: async () => [],
        searchVisual: async () => [],
        embedQuery: async () => ({
          ok: true,
          vector: Array.from({ length: 768 }, () => 0.01),
          cacheHit: true,
          embedSource: "l2_db",
          queryHash: "hash-zero",
          circuitState: "closed",
        }),
      },
    });
    assert.equal(zeroHit.outcome, "hybrid");
    assert.equal(zeroHit.cards.length, 0);
    assert.equal(zeroHit.liveEmbedToPersist, null);
  } finally {
    resetVisualSearchConfigCacheForTests();
    resetHybridSearchResultCacheForTests();
  }
});

test("10-minute result cache serves offset > 0 scroll pages without re-running SQL or ANN", async () => {
  resetHybridSearchResultCacheForTests();
  resetVisualSearchConfigCacheForTests();
  setVisualSearchFlagsForTests({ enabled: true, maxVisualDistance: 0.7 });

  let textCalls = 0;
  let visualCalls = 0;
  const manyVisual = Array.from({ length: 120 }, (_, i) => ({
    id: `vis-${i}`,
    slug: `vis-${i}`,
    title_ru: `визуал ${i}`,
    title_en: null,
    seo_tags: null,
    relevance_score: 500 - i,
    match_type: "visual",
    visual_distance: 0.2 + i * 0.001,
    source_date: "2026-01-01T00:00:00.000Z",
  }));

  const deps = {
    searchText: async () => {
      textCalls += 1;
      return [textCard];
    },
    searchVisual: async () => {
      visualCalls += 1;
      return manyVisual;
    },
    embedQuery: async () => ({
      ok: true as const,
      vector: Array.from({ length: 768 }, () => 0.01),
      cacheHit: true,
      embedSource: "l2_db" as const,
      queryHash: "hash-scroll",
      circuitState: "closed",
    }),
  };

  try {
    const page1 = await runHybridCardSearch({
      query: "ночной портрет",
      limit: 48,
      offset: 0,
      enableResultCache: true,
      headers: new Headers(),
      supabase: { async rpc() { return { data: null, error: null }; } },
      deps,
    });
    const page2 = await runHybridCardSearch({
      query: "ночной портрет",
      limit: 48,
      offset: 48,
      enableResultCache: true,
      headers: new Headers(),
      supabase: { async rpc() { return { data: null, error: null }; } },
      deps,
    });

    assert.equal(page1.resultCacheHit, false);
    assert.equal(page2.resultCacheHit, true);
    assert.equal(page1.cards.length, 48);
    assert.equal(page2.cards.length, 48);
    assert.notEqual(page1.cards[0]?.id, page2.cards[0]?.id);
    assert.equal(textCalls, 1);
    assert.equal(visualCalls, 1);
  } finally {
    resetVisualSearchConfigCacheForTests();
    resetHybridSearchResultCacheForTests();
  }
});
