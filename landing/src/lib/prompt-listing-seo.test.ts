import assert from "node:assert/strict";
import test from "node:test";
import { resolveUrlToTags } from "./route-resolver";
import {
  buildPromptListingHeadline,
  buildPromptListingMetaDescription,
} from "./prompt-listing-seo";
import { getSeoForRoute } from "./seo-templates";

const FORBIDDEN_PHOTOSHOOT_TERMS = /ИИ фотосесс/i;
const FORBIDDEN_EXTERNAL_CTA = /ChatGPT|Gemini|Nano Banana|вставь текст/i;

test("L2 audience + style combo keeps the single-frame catalog intent", () => {
  const route = resolveUrlToTags([
    "promty-dlya-foto-devushki",
    "studiynoe",
  ]);
  assert.ok(route);

  const seo = getSeoForRoute(route);
  assert.equal(seo.h1, "Промты для фото девушки — студийное");
  assert.match(seo.metaTitle, /^Промты для фото девушки — студийное/);
  assert.doesNotMatch(
    `${seo.h1} ${seo.metaTitle} ${seo.metaDescription}`,
    FORBIDDEN_PHOTOSHOOT_TERMS,
  );
  assert.doesNotMatch(seo.metaDescription, FORBIDDEN_EXTERNAL_CTA);
  assert.match(seo.metaDescription, /повтори кадр в 1 клик/i);
});

test("L2 audience + object combo keeps its exact query in H1", () => {
  const route = resolveUrlToTags([
    "promty-dlya-foto-devushki",
    "s-cvetami",
  ]);
  assert.ok(route);

  const seo = getSeoForRoute(route);
  assert.equal(seo.h1, "Промты для фото девушки с цветами");
  assert.doesNotMatch(
    `${seo.h1} ${seo.metaTitle} ${seo.metaDescription}`,
    FORBIDDEN_PHOTOSHOOT_TERMS,
  );
});

test("manual birthday L2 keeps long-tail H1", () => {
  const route = resolveUrlToTags([
    "sobytiya",
    "den-rozhdeniya",
    "devushki",
  ]);
  assert.ok(route);
  assert.equal(getSeoForRoute(route).h1, "Промт на день рождения девушке");
});

test("catalog builders never append the photoshoot complement", () => {
  const women = resolveUrlToTags(["promty-dlya-foto-devushki"]);
  const pairs = resolveUrlToTags(["promty-dlya-foto-par"]);
  assert.ok(women && pairs);

  assert.equal(
    buildPromptListingHeadline(women.tags),
    "Промты для фото девушки",
  );
  assert.doesNotMatch(
    buildPromptListingMetaDescription(pairs.tags),
    FORBIDDEN_PHOTOSHOOT_TERMS,
  );
  assert.match(
    buildPromptListingMetaDescription(pairs.tags),
    /скопируй промт бесплатно/i,
  );
});

test("new year postcard combo uses manual catalog copy and style-first canonical", () => {
  const canonical = resolveUrlToTags(["stil", "otkrytka", "novyj-god"]);
  const occasionFirst = resolveUrlToTags(["sobytiya", "novyj-god", "otkrytka"]);
  assert.ok(canonical && occasionFirst);
  assert.equal(canonical.canonicalPath, "/stil/otkrytka/novyj-god");
  assert.equal(occasionFirst.canonicalPath, "/stil/otkrytka/novyj-god");

  const seo = getSeoForRoute(canonical);
  assert.equal(seo.h1, "Промты для новогодней открытки");
  assert.equal(seo.metaTitle, "Промты для новогодней открытки | PromptShot");
  assert.doesNotMatch(
    `${seo.h1} ${seo.metaTitle} ${seo.metaDescription} ${seo.intro}`,
    FORBIDDEN_PHOTOSHOOT_TERMS,
  );
  assert.doesNotMatch(seo.metaDescription, FORBIDDEN_EXTERNAL_CTA);
});

test("car L1 first screen stays on copy-or-Repeat CTA", () => {
  const route = resolveUrlToTags(["s-mashinoy"]);
  assert.ok(route);
  const seo = getSeoForRoute(route);
  assert.equal(seo.h1, "Промты для фото с машиной");
  assert.equal(seo.metaTitle, "Промты для фото с машиной | PromptShot");
  assert.match(seo.intro, /промт с машиной/i);
  assert.match(seo.intro, /повтори кадр в 1 клик/i);
  assert.doesNotMatch(
    `${seo.h1} ${seo.metaTitle} ${seo.metaDescription} ${seo.intro}`,
    FORBIDDEN_PHOTOSHOOT_TERMS,
  );
  assert.doesNotMatch(
    `${seo.metaDescription} ${seo.intro} ${seo.howToSteps?.join(" ") ?? ""}`,
    FORBIDDEN_EXTERNAL_CTA,
  );
  assert.equal(seo.popularLinks?.[0]?.href, "/promty-dlya-foto-devushki/s-mashinoy");
  assert.equal(
    seo.popularLinks?.find((link) => link.label === "ИИ-фотосессия")?.href,
    "/ii-fotosessiya/s-mashinoy",
  );
});
