import assert from "node:assert/strict";
import test from "node:test";
import { HOMEPAGE_SEO } from "./homepage-seo-copy";
import { resolveUrlToTags } from "./route-resolver";
import { getSeoForRoute } from "./seo-templates";
import {
  buildHeroCarouselImageAlt,
  headingAltSlotsFromSeo,
  listingHeadingImageAlt,
} from "./hero-carousel-alt";

test("rotates H1 and H2 then repeats", () => {
  const slots = ["Промты для фото девушки", "Промты для ИИ фотосессии женские"];
  const hook = "Visual Hook: Осенняя эстетика с тыквами";
  assert.match(
    buildHeroCarouselImageAlt(0, slots, hook),
    /^Промты для фото девушки\. Осенняя эстетика с тыквами/,
  );
  assert.match(
    buildHeroCarouselImageAlt(1, slots, hook),
    /^Промты для ИИ фотосессии женские\. Осенняя эстетика с тыквами/,
  );
  assert.equal(
    buildHeroCarouselImageAlt(2, slots, hook),
    buildHeroCarouselImageAlt(0, slots, hook),
  );
});

test("empty slots fall back to card listing alt", () => {
  assert.equal(
    buildHeroCarouselImageAlt(0, [], "Visual Hook: Силуэт в платье"),
    "Промт для фото: Силуэт в платье",
  );
});

test("blank hook keeps the heading slot only", () => {
  assert.equal(
    buildHeroCarouselImageAlt(0, ["Промты для фото девушки"], "   "),
    "Промты для фото девушки",
  );
});

test("catalog hubs queue H1 then explorer H2, not HowTo", () => {
  const girls = resolveUrlToTags(["promty-dlya-foto-devushki"]);
  const men = resolveUrlToTags(["promty-dlya-foto-muzhchiny"]);
  const pairs = resolveUrlToTags(["promty-dlya-foto-par"]);
  assert.ok(girls && men && pairs);

  const girlsSlots = headingAltSlotsFromSeo(getSeoForRoute(girls));
  const menSlots = headingAltSlotsFromSeo(getSeoForRoute(men));
  const pairsSlots = headingAltSlotsFromSeo(getSeoForRoute(pairs));

  assert.deepEqual(girlsSlots, [
    "Промты для фото девушки",
    "Промты для ИИ фотосессии женские",
  ]);
  assert.deepEqual(menSlots, [
    "Промты для фото мужчины",
    "Промты для ИИ фотосессии мужские",
  ]);
  assert.equal(pairsSlots[0], "Промты для парных фото");
  assert.match(pairsSlots[1] ?? "", /парной фотосессии/i);
  assert.equal(girlsSlots.includes(getSeoForRoute(girls).howToTitle ?? ""), false);
});

test("listingHeadingImageAlt is undefined without slots", () => {
  assert.equal(
    listingHeadingImageAlt(0, undefined, "Visual Hook: Силуэт в платье"),
    undefined,
  );
  assert.equal(
    listingHeadingImageAlt(0, [], "Visual Hook: Силуэт в платье"),
    undefined,
  );
});

test("listingHeadingImageAlt matches carousel H1/H2 rotation", () => {
  const slots = ["Промты для фото девушки", "Промты для ИИ фотосессии женские"];
  const title = "Visual Hook: Осенняя эстетика с тыквами";
  assert.equal(
    listingHeadingImageAlt(0, slots, title),
    buildHeroCarouselImageAlt(0, slots, title),
  );
  assert.equal(
    listingHeadingImageAlt(11, slots, title),
    buildHeroCarouselImageAlt(11, slots, title),
  );
  assert.match(
    listingHeadingImageAlt(11, slots, title) ?? "",
    /^Промты для ИИ фотосессии женские\. /,
  );
});

test("homepage carousel slots are visible H1 then gallery H2", () => {
  const slots = [
    `${HOMEPAGE_SEO.h1.main} ${HOMEPAGE_SEO.h1.accent}`,
    HOMEPAGE_SEO.galleryTitle,
  ];
  assert.equal(slots[0], "Промты для фото ИИ");
  assert.equal(slots[1], "Идеи промтов для фото");
  assert.equal(slots.includes(HOMEPAGE_SEO.howToTitle), false);
  assert.match(
    buildHeroCarouselImageAlt(1, slots, "Visual Hook: Портрет"),
    /^Идеи промтов для фото\. Портрет/,
  );
});
