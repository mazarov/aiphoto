import assert from "node:assert/strict";
import test from "node:test";
import {
  resetListingHybridSearchForTests,
  searchListingCardsHybrid,
} from "./listing-hybrid-search";

const textCard = {
  id: "text-1",
  slug: "text-1",
  title_ru: "день рождения ребенка",
  title_en: null,
  seo_tags: null,
  relevance_score: 400,
  match_type: "fts",
};

function card(id: string, matchType: string) {
  return {
    id,
    slug: id,
    title_ru: "день рождения ребенка",
    title_en: null,
    seo_tags: null,
    relevance_score: matchType === "visual" ? 200 : 400,
    match_type: matchType,
    visual_distance: matchType === "visual" ? 0.2 : undefined,
    source_date: "2026-01-01T00:00:00.000Z",
  };
}

test("listing hybrid stays on text and peeks one extra row when visual is off", async () => {
  resetListingHybridSearchForTests();
  const previous = process.env.SEARCH_VISUAL_ENABLED;
  process.env.SEARCH_VISUAL_ENABLED = "0";
  try {
    let requestedLimit = 0;
    const result = await searchListingCardsHybrid({
      query: "день рождения ребенка",
      limit: 10,
      offset: 0,
      headers: new Headers(),
      supabase: { async rpc() { return { data: null, error: null }; } },
      deps: {
        searchText: async (_query, limit) => {
          requestedLimit = limit;
          return [textCard];
        },
        searchVisual: async () => {
          throw new Error("should not search visual");
        },
        embedQuery: async () => {
          throw new Error("should not embed");
        },
      },
    });
    assert.equal(requestedLimit, 11);
    assert.equal(result.outcome, "text");
    assert.equal(result.allowlisted, true);
    assert.equal(result.hasMore, false);
    assert.deepEqual(result.cards.map((item) => item.id), ["text-1"]);
  } finally {
    process.env.SEARCH_VISUAL_ENABLED = previous;
    resetListingHybridSearchForTests();
  }
});

test("non-allowlisted listing q stays on FTS and does not embed", async () => {
  resetListingHybridSearchForTests();
  const previous = process.env.SEARCH_VISUAL_ENABLED;
  process.env.SEARCH_VISUAL_ENABLED = "1";
  try {
    const result = await searchListingCardsHybrid({
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
        embedQuery: async () => {
          throw new Error("should not embed");
        },
      },
    });
    assert.equal(result.allowlisted, false);
    assert.equal(result.outcome, "text");
    assert.equal(result.resultCacheHit, false);
  } finally {
    process.env.SEARCH_VISUAL_ENABLED = previous;
    resetListingHybridSearchForTests();
  }
});

test("listing hybrid peeks past FTS so embeddings can fill the page", async () => {
  resetListingHybridSearchForTests();
  const previous = process.env.SEARCH_VISUAL_ENABLED;
  process.env.SEARCH_VISUAL_ENABLED = "1";
  try {
    const visualCards = Array.from({ length: 20 }, (_, index) =>
      card(`visual-${index}`, "visual"),
    );
    const result = await searchListingCardsHybrid({
      query: "день рождения ребенка",
      limit: 10,
      offset: 0,
      headers: new Headers(),
      supabase: { async rpc() { return { data: null, error: null }; } },
      deps: {
        searchText: async () => [textCard],
        searchVisual: async () => visualCards,
        embedQuery: async () => ({
          ok: true,
          vector: Array.from({ length: 768 }, () => 0.01),
          cacheHit: false,
          circuitState: "closed",
        }),
      },
    });
    assert.equal(result.outcome, "hybrid");
    assert.equal(result.budgetActor, "system");
    assert.equal(result.cards.length, 10);
    assert.equal(result.hasMore, true);
    assert.equal(result.cards[0]?.id, "text-1");
    assert.equal(result.resultCacheHit, false);
  } finally {
    process.env.SEARCH_VISUAL_ENABLED = previous;
    resetListingHybridSearchForTests();
  }
});

test("listing hybrid caches a successful result for later pages", async () => {
  resetListingHybridSearchForTests();
  const previous = process.env.SEARCH_VISUAL_ENABLED;
  process.env.SEARCH_VISUAL_ENABLED = "1";
  let embeds = 0;
  let visualCalls = 0;
  const visualCards = Array.from({ length: 20 }, (_, index) =>
    card(`visual-${index}`, "visual"),
  );
  const deps = {
    searchText: async () => [textCard],
    searchVisual: async () => {
      visualCalls += 1;
      return visualCards;
    },
    embedQuery: async () => {
      embeds += 1;
      return {
        ok: true as const,
        vector: Array.from({ length: 768 }, () => 0.01),
        cacheHit: false,
        circuitState: "closed",
      };
    },
  };
  try {
    const first = await searchListingCardsHybrid({
      query: "день рождения ребенка",
      limit: 10,
      offset: 0,
      headers: new Headers(),
      supabase: { async rpc() { return { data: null, error: null }; } },
      deps,
    });
    const second = await searchListingCardsHybrid({
      query: "день рождения ребенка",
      limit: 10,
      offset: 10,
      headers: new Headers(),
      supabase: { async rpc() { return { data: null, error: null }; } },
      deps,
    });
    assert.equal(first.outcome, "hybrid");
    assert.equal(second.outcome, "hybrid");
    assert.equal(second.resultCacheHit, true);
    assert.equal(embeds, 1);
    assert.equal(visualCalls, 1);
    assert.equal(second.cards[0]?.id, "visual-9");
  } finally {
    process.env.SEARCH_VISUAL_ENABLED = previous;
    resetListingHybridSearchForTests();
  }
});

test("listing hybrid does not cache a text fallback", async () => {
  resetListingHybridSearchForTests();
  const previous = process.env.SEARCH_VISUAL_ENABLED;
  process.env.SEARCH_VISUAL_ENABLED = "1";
  let embeds = 0;
  try {
    await searchListingCardsHybrid({
      query: "день рождения ребенка",
      limit: 10,
      offset: 0,
      headers: new Headers(),
      supabase: { async rpc() { return { data: null, error: null }; } },
      deps: {
        searchText: async () => [textCard],
        searchVisual: async () => [],
        embedQuery: async () => {
          embeds += 1;
          return {
            ok: false,
            reason: "timeout",
            cacheHit: false,
            circuitState: "open",
          };
        },
      },
    });
    await searchListingCardsHybrid({
      query: "день рождения ребенка",
      limit: 10,
      offset: 0,
      headers: new Headers(),
      supabase: { async rpc() { return { data: null, error: null }; } },
      deps: {
        searchText: async () => [textCard],
        searchVisual: async () => [],
        embedQuery: async () => {
          embeds += 1;
          return {
            ok: false,
            reason: "timeout",
            cacheHit: false,
            circuitState: "open",
          };
        },
      },
    });
    assert.equal(embeds, 2);
  } finally {
    process.env.SEARCH_VISUAL_ENABLED = previous;
    resetListingHybridSearchForTests();
  }
});
