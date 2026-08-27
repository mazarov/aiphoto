import assert from "node:assert/strict";
import test from "node:test";
import { buildThemeCollageFromNewestResults } from "./homepage-sections";
import type { RouteCardsResult } from "./supabase";

function result(
  cards: RouteCardsResult["cards"],
  total_count: number
): RouteCardsResult {
  return {
    cards,
    tier_used: "A",
    cards_count: cards.length,
    total_count,
    has_minimum: true,
    dimension_count: 1,
  };
}

test("newest theme collage keeps route order and up to 6 unique photos", () => {
  const collage = buildThemeCollageFromNewestResults(
    [
      {
        href: "/promty-dlya-foto-devushki",
        dimension: "audience_tag",
        tagValue: "devushka",
      },
      {
        href: "/stil/portret",
        dimension: "style_tag",
        tagValue: "portret",
      },
    ],
    [
      result(
        [
          {
            id: "1",
            slug: "new-1",
            title_ru: null,
            title_en: null,
            seo_tags: {},
            relevance_score: 0,
          },
          {
            id: "2",
            slug: "new-2",
            title_ru: null,
            title_en: null,
            seo_tags: {},
            relevance_score: 0,
          },
          {
            id: "3",
            slug: "new-1-dup",
            title_ru: null,
            title_en: null,
            seo_tags: {},
            relevance_score: 0,
          },
        ],
        42
      ),
      result([], 0),
    ],
    new Map([
      ["new-1", { photoUrl: "https://img/new-1.jpg" }],
      ["new-2", { photoUrl: "https://img/new-2.jpg" }],
      ["new-1-dup", { photoUrl: "https://img/new-1.jpg" }],
    ])
  );

  assert.deepEqual(collage.photosByHref["/promty-dlya-foto-devushki"], [
    "https://img/new-1.jpg",
    "https://img/new-2.jpg",
  ]);
  assert.equal(collage.countByHref["/promty-dlya-foto-devushki"], 42);
  assert.deepEqual(collage.photosByHref["/stil/portret"], []);
  assert.equal(collage.countByHref["/stil/portret"], 0);
});
