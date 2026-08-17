import assert from "node:assert/strict";
import test from "node:test";
import { runHybridCardSearch } from "./visual-search";

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
  const previous = process.env.SEARCH_VISUAL_ENABLED;
  process.env.SEARCH_VISUAL_ENABLED = "1";
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
          circuitState: "open",
        }),
      },
    });
    assert.equal(result.outcome, "text_fallback");
    assert.equal(result.fallbackReason, "timeout");
    assert.deepEqual(result.cards.map((card) => card.id), ["text-1"]);
  } finally {
    process.env.SEARCH_VISUAL_ENABLED = previous;
  }
});

test("hybrid search merges visual candidates when embedding succeeds", async () => {
  const previous = process.env.SEARCH_VISUAL_ENABLED;
  process.env.SEARCH_VISUAL_ENABLED = "1";
  try {
    const result = await runHybridCardSearch({
      query: "ночной портрет",
      limit: 10,
      offset: 0,
      headers: new Headers(),
      supabase: { async rpc() { return { data: null, error: null }; } },
      deps: {
        searchText: async () => [textCard],
        searchVisual: async () => [visualCard],
        embedQuery: async () => ({
          ok: true,
          vector: Array.from({ length: 768 }, () => 0.01),
          cacheHit: false,
          circuitState: "closed",
        }),
      },
    });
    assert.equal(result.outcome, "hybrid");
    assert.equal(result.cards[0]?.id, "text-1");
    assert.equal(result.cards.some((card) => card.id === "visual-1"), true);
  } finally {
    process.env.SEARCH_VISUAL_ENABLED = previous;
  }
});
