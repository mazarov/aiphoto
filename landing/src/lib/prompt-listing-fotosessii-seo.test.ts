import assert from "node:assert/strict";
import test from "node:test";
import { resolveUrlToTags } from "./route-resolver";
import {
  buildPromptListingHeadline,
  buildPromptListingMetaDescription,
  enrichPromptListingHead,
  promptListingFotosessiiTail,
} from "./prompt-listing-fotosessii-seo";
import { getSeoForRoute } from "./seo-templates";

test("L2 audience + style combo gets fotosessii complement in head", () => {
  const route = resolveUrlToTags(["promty-dlya-foto-devushki", "studiynoe"]);
  assert.ok(route);
  const seo = getSeoForRoute(route);
  assert.equal(
    seo.h1,
    "Промты для фото девушки — студийное и ИИ фотосессии",
  );
  assert.match(
    seo.metaTitle,
    /Промты для фото девушки — студийное и ИИ фотосессии \| PromptShot/,
  );
  assert.match(
    seo.metaDescription,
    /промты для ИИ фотосессии женские студийные/i,
  );
  assert.match(seo.metaDescription, /промты для фото девушки — студийное/i);
  assert.equal(
    seo.seoTextBlocks?.[0]?.h2,
    "Промты для ИИ фотосессии женские студийные",
  );
});

test("L2 audience + object combo keeps кадр key first", () => {
  const route = resolveUrlToTags(["promty-dlya-foto-devushki", "s-cvetami"]);
  assert.ok(route);
  const seo = getSeoForRoute(route);
  assert.equal(
    seo.h1,
    "Промты для фото девушки с цветами и ИИ фотосессии",
  );
  assert.match(seo.metaDescription, /женские с цветами/i);
});

test("manual birthday L2 keeps long-tail H1 without fotosessii complement", () => {
  const route = resolveUrlToTags(["sobytiya", "den-rozhdeniya", "devushki"]);
  assert.ok(route);
  const seo = getSeoForRoute(route);
  assert.equal(seo.h1, "Промт на день рождения девушке");
  assert.doesNotMatch(seo.h1, /фотосесс/i);
});

test("enrich upgrades legacy L1 head without touching long-tail manual", () => {
  const route = resolveUrlToTags(["stil", "studiynoe"]);
  assert.ok(route);
  const enriched = enrichPromptListingHead(
    {
      h1: "Промты для студийного фото",
      metaTitle: "old",
      metaDescription: "old",
      intro: "Старый intro.",
      howToSteps: [],
    },
    route.tags,
  );
  assert.equal(
    enriched.h1,
    "Промты для студийного фото и ИИ фотосессии",
  );
  assert.match(enriched.metaDescription, /промты для ИИ фотосессии студийные/i);
});

test("fotosessii tail uses curated adjectives", () => {
  const women = resolveUrlToTags(["promty-dlya-foto-devushki"]);
  const pairs = resolveUrlToTags(["promty-dlya-foto-par"]);
  assert.ok(women && pairs);
  assert.equal(promptListingFotosessiiTail(women.tags), "женские");
  assert.equal(promptListingFotosessiiTail(pairs.tags), "парные");
  assert.equal(
    buildPromptListingHeadline(women.tags),
    "Промты для фото девушки и ИИ фотосессии",
  );
  assert.match(
    buildPromptListingMetaDescription(pairs.tags),
    /промты для ИИ фотосессии парные/i,
  );
});
