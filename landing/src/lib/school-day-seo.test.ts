import assert from "node:assert/strict";
import test from "node:test";
import { GENERACIYA_SEO_IMAGE_FLAGS_OFF } from "./generaciya-seo-image-flags";
import type { GeneraciyaSeoImageFlags } from "./generaciya-seo-image-flags";
import { GENERACIYA_SEO_POOL_LIMIT } from "./generaciya-seo-fetch";
import {
  presentSchoolDaySeoCards,
  schoolDaySeoApplies,
  schoolDaySeoHeroFetchParams,
} from "./school-day-seo";
import {
  DEN_UCHITELYA_HUB_PATH,
  DEN_VOSPITATELYA_HUB_PATH,
} from "./school-day-hubs";
import type { PromptCardFull } from "./supabase";

const FLAGS_ON: GeneraciyaSeoImageFlags = {
  logs: true,
  src1080: true,
  singlePass: true,
  descriptiveAlt: true,
  firstScreenRank: true,
};

const H1 = "Промты на день учителя";

function card(id: string, title: string): PromptCardFull {
  return {
    id,
    slug: id,
    title_ru: title,
    title_en: null,
    seo_tags: {},
    relevance_score: 0,
    promptTexts: ["prompt"],
    hasRuPrompt: true,
    photoUrls: [`https://cdn.example/${id}.jpg`],
    photoMeta: [
      {
        url: `https://cdn.example/${id}.jpg`,
        bucket: "cards",
        path: `channel/${id}.jpg`,
        width: 1200,
        height: 1600,
      },
    ],
    beforePhotoUrl: null,
    datasetSlug: "telegram_export",
    sourceMessageId: null,
    sourceDate: null,
    hashtags: [],
    warnings: [],
    seoReadinessScore: 0,
    photoCount: 1,
    promptCount: 1,
    cardSplitIndex: 0,
    cardSplitTotal: 1,
    sourceGroupKey: `group-${id}`,
    likesCount: 0,
    dislikesCount: 0,
    viewCount: 0,
  };
}

test("school day SEO stack stays on the clean hub URL", () => {
  assert.equal(schoolDaySeoApplies(DEN_UCHITELYA_HUB_PATH, null), true);
  assert.equal(schoolDaySeoApplies(`${DEN_VOSPITATELYA_HUB_PATH}/`, {}), true);
  assert.equal(
    schoolDaySeoApplies(DEN_UCHITELYA_HUB_PATH, { audience: "devushka" }),
    false,
  );
  assert.equal(schoolDaySeoApplies(DEN_UCHITELYA_HUB_PATH, { sort: "new" }), false);
  assert.equal(schoolDaySeoApplies("/promty-dlya-foto/osen", null), false);
  assert.equal(schoolDaySeoApplies(`${DEN_UCHITELYA_HUB_PATH}/portret`, null), false);
});

test("rank flag switches the hero pool from newest 16 to popular 64", () => {
  const plain = schoolDaySeoHeroFetchParams("den_uchitelya", false);
  assert.equal(plain.sort, "new");
  assert.equal(plain.limit, 16);
  assert.equal(plain.occasion_tag, "den_uchitelya");
  assert.equal(plain.audience_tag, null);

  const ranked = schoolDaySeoHeroFetchParams("den_vospitatelya", true);
  assert.equal(ranked.sort, "popular");
  assert.equal(ranked.limit, GENERACIYA_SEO_POOL_LIMIT);
  assert.equal(ranked.occasion_tag, "den_vospitatelya");
});

test("first 16 frames get the SEO image and a heading-free alt", () => {
  const hero = Array.from({ length: 12 }, (_, index) =>
    card(`h${index + 1}`, `Учительница у доски, кадр ${index + 1}`),
  );
  const listing = [
    hero[0],
    hero[1],
    ...Array.from({ length: 8 }, (_, index) =>
      card(`l${index + 1}`, `Букет для воспитателя, кадр ${index + 1}`),
    ),
  ];
  const presented = presentSchoolDaySeoCards({
    heroCards: hero,
    listingCards: listing,
    flags: FLAGS_ON,
    headings: [H1, "Идеи фото ко дню учителя"],
    siteUrl: "https://promptshot.ru",
  });

  assert.equal(presented.heroExamples.length, 12);
  assert.ok(presented.heroExamples.every((item) => item.seoFrame?.mode === "both"));
  const firstAlt = presented.heroExamples[0]?.seoFrame?.alts?.[0] ?? "";
  assert.equal(firstAlt.includes(H1), false);
  assert.match(firstAlt, /Учительница у доски/);
  assert.match(presented.heroExamples[0]?.seoFrame?.linkLabel ?? "", /^Открыть промт «/);
  assert.match(presented.ogImage ?? "", /^https:\/\/promptshot\.ru\/img\/seo\/w1080\/cards\//);
  assert.equal(presented.imageCaption?.includes(H1), false);

  const framedListing = presented.listingCards.filter((item) => item.seoFrame);
  assert.equal(framedListing.length, 6);
  assert.deepEqual(
    framedListing.map((item) => item.id),
    ["h1", "h2", "l1", "l2", "l3", "l4"],
  );
  assert.equal(presented.listingCards[9]?.seoFrame, undefined);
});

test("flags off keep the catalog image and the H1 alt path", () => {
  const hero = [card("h1", "Учительница у доски")];
  const presented = presentSchoolDaySeoCards({
    heroCards: hero,
    listingCards: hero,
    flags: GENERACIYA_SEO_IMAGE_FLAGS_OFF,
    headings: [H1],
  });
  assert.equal(presented.heroExamples[0]?.seoFrame, undefined);
  assert.equal(presented.listingCards[0]?.seoFrame, undefined);
  assert.equal(presented.ogImage, null);
  assert.equal(presented.imageCaption, null);
});
