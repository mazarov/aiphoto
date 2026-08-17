import assert from "node:assert/strict";
import test from "node:test";
import { mergeHybridSearchResults } from "./visual-search-rank";

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

test("pins exact title and strong FTS above visual-only hits", () => {
  const merged = mergeHybridSearchResults({
    query: "ночной портрет",
    text: [
      card("exact", "trgm", 10, "ночной портрет"),
      card("fts", "fts", 400, "другой заголовок"),
    ],
    visual: [
      { ...card("visual", "visual", 900, "неон"), visual_distance: 0.01 },
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
