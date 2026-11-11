import assert from "node:assert/strict";
import test from "node:test";
import {
  ENGAGEMENT_BOOST_CAP,
  computeSearchEngagementBoost,
  mergeHybridSearchResults,
} from "./visual-search-rank";

function card(
  id: string,
  match_type: string,
  relevance_score: number,
  title_ru = id,
) {
  return {
    id,
    slug: id,
    title_ru,
    title_en: null,
    seo_tags: null,
    relevance_score,
    match_type,
  };
}

test("pins exact title (including yo-to-e) and strong FTS above visual-only hits", () => {
  const merged = mergeHybridSearchResults({
    query: "черно-белый портрет",
    text: [
      card("exact", "trgm", 10, "Чёрно-белый портрет"),
      card("fts", "fts", 400, "другой заголовок"),
    ],
    visual: [
      { ...card("visual", "visual", 900, "неон"), visual_distance: 0.01, search_clicks_30d: 500 },
      { ...card("fts", "visual", 100, "другой заголовок"), visual_distance: 0.2 },
    ],
    limit: 10,
    offset: 0,
  });
  assert.deepEqual(
    merged.map((row) => row.id),
    ["exact", "fts", "visual"],
  );
  assert.equal(merged[1]?.match_type, "fts+visual");
  assert.equal(merged[2]?.match_type, "visual");
});

test("soft quorum FTS stays in Tier 2 and boosts RRF without bypassing strong FTS", () => {
  const merged = mergeHybridSearchResults({
    query: "девушка у ретро машины ночью",
    text: [
      card("strong", "fts", 350, "девушка у машины"),
      card("soft", "fts_soft", 190, "девушка у ретро автомобиля ночью"),
    ],
    visual: [
      { ...card("vis-1", "visual", 800, "портрет"), visual_distance: 0.15 },
      { ...card("soft", "visual", 800, "девушка у ретро автомобиля ночью"), visual_distance: 0.18 },
    ],
    limit: 10,
    offset: 0,
  });
  assert.equal(merged[0]?.id, "strong");
  assert.equal(merged[1]?.id, "soft");
  assert.equal(merged[1]?.match_type, "fts+visual");
});

test("CTR engagement boost lifts clicked cards among close Tier 2 candidates but stays capped", () => {
  assert.equal(computeSearchEngagementBoost(0, 0), 0);
  assert.equal(computeSearchEngagementBoost(100_000, 1_000_000), ENGAGEMENT_BOOST_CAP);

  const merged = mergeHybridSearchResults({
    query: "неон",
    text: [],
    visual: [
      { ...card("vis-rank-1-cold", "visual", 800, "а"), visual_distance: 0.20, search_clicks_30d: 0, view_count: 0 },
      { ...card("vis-rank-2-clicked", "visual", 800, "б"), visual_distance: 0.21, search_clicks_30d: 15, view_count: 200 },
    ],
    limit: 10,
    offset: 0,
  });

  // Rank 2 with 15 search clicks overtakes adjacent Rank 1 with 0 clicks.
  assert.deepEqual(
    merged.map((row) => row.id),
    ["vis-rank-2-clicked", "vis-rank-1-cold"],
  );
});

test("paginates a stable merged window", () => {
  const text = Array.from({ length: 5 }, (_, i) =>
    card(`t${i}`, "fts", 300 - i, `t${i}`),
  );
  const page = mergeHybridSearchResults({
    query: "q",
    text,
    visual: [],
    limit: 2,
    offset: 2,
  });
  assert.deepEqual(
    page.map((row) => row.id),
    ["t2", "t3"],
  );
});
