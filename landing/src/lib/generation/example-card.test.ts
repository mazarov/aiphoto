import assert from "node:assert/strict";
import test from "node:test";
import {
  filterExampleCardsByQuery,
  filterPhotoshootExampleCards,
  toGenerationExampleCard,
} from "./example-card";
import type { PhotoMeta, PromptCardFull } from "@/lib/supabase";

const tileMeta = (index: number): PhotoMeta => ({
  url: `https://img/${index}.jpg`,
  bucket: "landing-generations",
  path: `user/job/lease-${index}.jpg`,
  width: 512,
  height: 512,
});

function fakeCard(overrides: Partial<PromptCardFull> = {}): PromptCardFull {
  return {
    id: "card-1",
    slug: "photoshoot-demo",
    title_ru: "Фотосессия",
    title_en: null,
    seo_tags: {},
    relevance_score: 0,
    promptTexts: ["a", "b", "c", "d"],
    hasRuPrompt: true,
    photoUrls: [
      "https://img/1.jpg",
      "https://img/2.jpg",
      "https://img/3.jpg",
      "https://img/4.jpg",
    ],
    photoMeta: [tileMeta(1), tileMeta(2), tileMeta(3), tileMeta(4)],
    beforePhotoUrl: null,
    datasetSlug: "web_generation_ugc",
    sourceMessageId: null,
    sourceDate: null,
    hashtags: [],
    warnings: [],
    seoReadinessScore: 0,
    photoCount: 4,
    promptCount: 4,
    cardSplitIndex: 0,
    cardSplitTotal: 1,
    sourceGroupKey: null,
    likesCount: 0,
    dislikesCount: 0,
    viewCount: 0,
    isPublished: true,
    ...overrides,
  };
}

test("filterPhotoshootExampleCards drops one-frame catalog cards", () => {
  const photoshoot = toGenerationExampleCard(fakeCard());
  const catalog = toGenerationExampleCard(
    fakeCard({
      id: "card-2",
      slug: "one-frame",
      datasetSlug: "telegram_export",
      photoUrls: ["https://img/1.jpg"],
      photoMeta: [
        {
          url: "https://img/1.jpg",
          bucket: "public",
          path: "channel/photo.jpg",
          width: 512,
          height: 512,
        },
      ],
      photoCount: 1,
    })
  );
  assert.equal(catalog.isPhotoshoot, false);
  assert.deepEqual(filterPhotoshootExampleCards([catalog, photoshoot]), [
    photoshoot,
  ]);
});

test("filterExampleCardsByQuery stays inside the provided set", () => {
  const photoshoot = toGenerationExampleCard(fakeCard({ title_ru: "Студия" }));
  assert.equal(filterExampleCardsByQuery([photoshoot], "сту").length, 1);
  assert.equal(filterExampleCardsByQuery([photoshoot], "пляж").length, 0);
});

test("toGenerationExampleCard keeps all photoshoot tile URLs", () => {
  const example = toGenerationExampleCard(fakeCard());
  assert.equal(example.isPhotoshoot, true);
  assert.equal(example.photoUrl, "https://img/1.jpg");
  assert.deepEqual(example.photoUrls, [
    "https://img/1.jpg",
    "https://img/2.jpg",
    "https://img/3.jpg",
    "https://img/4.jpg",
  ]);
});
