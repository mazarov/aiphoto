import assert from "node:assert/strict";
import test from "node:test";
import { resolveUrlToTags } from "./route-resolver";
import {
  buildPromptListingHeadline,
  buildPromptListingMetaDescription,
} from "./prompt-listing-seo";
import { getSeoForRoute } from "./seo-templates";
import {
  getSeoContent,
  listSeoContentSlugs,
  type SeoContent,
} from "./seo-content";
import { buildSeoContentFromTag } from "./seo-content-from-tag";
import { TAG_REGISTRY } from "./tag-registry";
import { TRENDS_FAQ, TRENDS_SEO, TRENDS_SEO_TEXT_BLOCKS } from "./trends-seo-copy";

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

test("girls hub keeps H1 and explorer photoshoot lemmas apart", () => {
  const route = resolveUrlToTags(["promty-dlya-foto-devushki"]);
  assert.ok(route);

  const seo = getSeoForRoute(route);
  const copy = `${seo.h1} ${seo.metaTitle} ${seo.metaDescription} ${seo.intro}`;
  assert.equal(seo.h1, "Промты для фото девушки");
  assert.equal(seo.metaTitle, "Промты для фото девушки — 7000+ идей");
  assert.match(copy, /7000\+/);
  assert.match(seo.intro, /женских фото/i);
  assert.match(
    seo.intro,
    /скопируй текст промта для нейросети или загрузи своё фото и повтори кадр в 1 клик/i,
  );
  assert.doesNotMatch(seo.intro, /фотосессии девушки/i);
  assert.doesNotMatch(seo.h1, /фотосессии/i);
  assert.match(seo.h1, /фото девушки/i);
  assert.match(seo.explorerTitle ?? "", /промты для ии фотосессии женские/i);
  assert.doesNotMatch(seo.explorerTitle ?? "", /откройте карточку|найдите свой сюжет/i);
  assert.match(
    seo.explorerIntro ?? "",
    /готовые промты для женской ии фотосессии на русском в нейросети/i,
  );
  assert.match(seo.explorerIntro ?? "", /студийные, черно-белые, деловой, портреты/i);
  assert.match(
    seo.explorerIntro ?? "",
    /скопируй текст промта для нейросети или загрузи своё фото и повтори кадр в 1 клик/i,
  );
  assert.doesNotMatch(seo.explorerIntro ?? "", /фотосессии девушки|найдите|поиск/i);
  assert.equal(seo.howToSteps.length, 0);
  assert.equal(seo.howToTitle, undefined);
  assert.equal(seo.popularLinks?.length ?? 0, 0);
  assert.equal(seo.seoTextBlocks?.length ?? 0, 0);
  assert.ok(seo.faqItems.some((item) => /промт для девушки/i.test(item.q)));
  assert.ok(seo.faqItems.some((item) => /один кадр или целая съёмка/i.test(item.q)));
  assert.doesNotMatch(copy, FORBIDDEN_EXTERNAL_CTA);
  assert.doesNotMatch(copy, /не описывай лицо|не описывайте лицо/i);
});

test("men hub keeps H1 and explorer photoshoot lemmas apart", () => {
  const route = resolveUrlToTags(["promty-dlya-foto-muzhchiny"]);
  assert.ok(route);

  const seo = getSeoForRoute(route);
  const copy = `${seo.h1} ${seo.metaTitle} ${seo.metaDescription} ${seo.intro}`;
  assert.equal(seo.h1, "Промты для фото мужчины");
  assert.equal(seo.metaTitle, "Промты для фото мужчины и мужских фото — 1300+ идей");
  assert.match(copy, /1300\+/);
  assert.match(seo.intro, /мужского фото/i);
  assert.doesNotMatch(seo.intro, /фотосессии/i);
  assert.doesNotMatch(seo.h1, /фотосессии/i);
  assert.match(seo.h1, /фото мужчины/i);
  assert.doesNotMatch(seo.h1, /мужских фото/i);
  assert.match(seo.metaTitle, /мужских фото/i);
  assert.match(seo.explorerTitle ?? "", /промты для ии фотосессии мужские/i);
  assert.doesNotMatch(seo.explorerTitle ?? "", /откройте карточку|найдите свой сюжет/i);
  assert.match(seo.explorerIntro ?? "", /промты для мужской фотосессии с ИИ/i);
  assert.match(seo.explorerIntro ?? "", /найдите|поиск|скопируй/i);
  assert.doesNotMatch(seo.howToTitle ?? "", /фотосессии/i);
  assert.match(seo.howToTitle ?? "", /мужского фото/i);
  assert.equal(seo.popularLinks?.length ?? 0, 0);
  assert.equal(seo.seoTextBlocks?.length ?? 0, 0);
  assert.ok(seo.faqItems.some((item) => /промт для фото мужской/i.test(item.q)));
  assert.ok(seo.faqItems.some((item) => /один кадр или целая съёмка/i.test(item.q)));
  assert.doesNotMatch(copy, FORBIDDEN_EXTERNAL_CTA);
  assert.doesNotMatch(copy, /не описывай лицо|не описывайте лицо/i);
});

test("pairs hub targets ИИ фотосессии пары in head and нейросеть in explorer", () => {
  const route = resolveUrlToTags(["promty-dlya-foto-par"]);
  assert.ok(route);

  const seo = getSeoForRoute(route);
  const headline = "Промты для ИИ фотосессии пары";
  const title = "Промты для ИИ фотосессии пары — 800+ готовых промтов на русском";
  const copy = `${seo.h1} ${seo.metaTitle} ${seo.metaDescription} ${seo.intro}`;
  assert.equal(seo.h1, headline);
  assert.equal(seo.metaTitle, title);
  assert.match(copy, /800\+/);
  assert.match(copy, /готов/i);
  assert.match(copy, /русск/i);
  assert.match(copy, /нейросет/i);
  assert.match(seo.h1, /ии фотосессии пары/i);
  assert.match(seo.metaTitle, /ии фотосессии пары/i);
  assert.match(seo.metaDescription, /ии фотосессии пары/i);
  assert.match(seo.intro, /парной фотосессии/i);
  assert.doesNotMatch(seo.intro, /ии фотосессии пары/i);
  assert.doesNotMatch(seo.h1, /с парнем/i);
  assert.doesNotMatch(seo.metaTitle, /с парнем/i);
  assert.doesNotMatch(seo.metaDescription, /с парнем/i);
  assert.doesNotMatch(copy, /скопируйте текст/i);
  assert.doesNotMatch(copy, /снимк/i);
  assert.match(seo.intro, /скопируйте промт для нейросети или загрузите два фото/i);
  assert.match(
    seo.metaDescription,
    /скопируйте промт для нейросети или загрузите два фото/i,
  );
  assert.equal(seo.explorerTitle, "Промт для нейросети для фотосессии пары");
  assert.doesNotMatch(seo.explorerTitle ?? "", /найдите свой сюжет/i);
  assert.match(seo.explorerIntro ?? "", /промты для парной фотосессии с ИИ/i);
  assert.match(seo.explorerIntro ?? "", /скопировать промт/i);
  assert.doesNotMatch(seo.explorerIntro ?? "", /скопировать текст/i);
  assert.doesNotMatch(seo.intro, /с парнем/i);
  assert.doesNotMatch(seo.howToSteps.join(" "), /с парнем/i);
  assert.equal(seo.popularLinks?.length ?? 0, 0);
  assert.equal(seo.seoTextBlocks?.length ?? 0, 0);
  assert.ok(seo.faqItems.some((item) => /промт для фото с парнем/i.test(item.q)));
  assert.ok(seo.faqItems.some((item) => /совместное фото/i.test(item.q)));
  assert.ok(seo.faqItems.some((item) => /два фото в один кадр/i.test(item.q)));
  assert.doesNotMatch(copy, FORBIDDEN_EXTERNAL_CTA);
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
  assert.equal(
    seo.popularLinks?.[0]?.href,
    "/promty-dlya-foto-devushki?object=s_mashinoy",
  );
  assert.equal(
    seo.popularLinks?.find((link) => link.label === "Мужчины")?.href,
    "/promty-dlya-foto-muzhchiny?object=s_mashinoy",
  );
  assert.equal(
    seo.popularLinks?.find((link) => link.label === "ИИ-фотосессия")?.href,
    "/ii-fotosessiya/s-mashinoy",
  );
});

const LISTING_BRAND_LEAK =
  /Nano Banana|нано банана|ChatGPT|Gemini|открой Nano Banana/i;

function flattenListingSeo(seo: SeoContent): string {
  return [
    seo.h1,
    seo.metaTitle,
    seo.metaDescription,
    seo.intro,
    seo.howToTitle,
    seo.explorerTitle,
    seo.explorerIntro,
    ...(seo.howToSteps ?? []),
    ...(seo.faqItems ?? []).flatMap((item) => [item.q, item.a]),
    ...(seo.seoTextBlocks ?? []).flatMap((block) => [
      block.h2,
      ...block.paragraphs,
    ]),
  ]
    .filter(Boolean)
    .join("\n");
}

test("manual listing copy does not keep the Nano Banana brand", () => {
  for (const slug of listSeoContentSlugs()) {
    const seo = getSeoContent(slug);
    assert.ok(seo, slug);
    assert.doesNotMatch(flattenListingSeo(seo), LISTING_BRAND_LEAK, slug);
    assert.doesNotMatch(flattenListingSeo(seo), FORBIDDEN_EXTERNAL_CTA, slug);
  }
});

test("tag template and trends do not keep the Nano Banana brand", () => {
  for (const tag of TAG_REGISTRY) {
    assert.doesNotMatch(
      flattenListingSeo(buildSeoContentFromTag(tag)),
      LISTING_BRAND_LEAK,
      tag.slug,
    );
  }
  const trends = [
    TRENDS_SEO.metaTitle,
    TRENDS_SEO.metaDescription,
    TRENDS_SEO.h1,
    TRENDS_SEO.intro,
    ...TRENDS_SEO.howToSteps,
    ...TRENDS_FAQ.flatMap((item) => [item.q, item.a]),
    ...TRENDS_SEO_TEXT_BLOCKS.flatMap((block) => [block.h2, ...block.paragraphs]),
  ].join("\n");
  assert.doesNotMatch(trends, LISTING_BRAND_LEAK);
  assert.doesNotMatch(trends, FORBIDDEN_EXTERNAL_CTA);
});
