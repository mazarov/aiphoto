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
  assert.equal(seo.metaTitle, "Промты для фото девушки 👩 — 7000+ идей 💡");
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
  const title = "Промты для ИИ фотосессии пары ❤️ — 800+ готовых промтов на русском 🇷🇺";
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

test("osen hub keeps photoshoot prompts in the head and идеи in explorer", () => {
  const route = resolveUrlToTags(["osen"]);
  assert.ok(route);

  const seo = getSeoForRoute(route);
  const h1 = "Промты для осенней фотосессии";
  assert.equal(seo.h1, h1);
  assert.equal(
    seo.metaTitle,
    "Промты для осенней фотосессии 🍂 — 300+ готовых промтов на русском 🇷🇺",
  );
  assert.match(seo.metaTitle, /300\+/);
  assert.doesNotMatch(seo.h1, /300\+|идеи/i);
  assert.match(seo.intro, /осенние промты для фото с ии/i);
  assert.doesNotMatch(seo.intro, /осенней фотосессии|идеи/i);
  assert.equal(seo.explorerTitle, "Идеи для осенней фотосессии");
  assert.doesNotMatch(seo.explorerTitle ?? "", /промты для осенней фотосессии/i);
  assert.match(seo.explorerIntro ?? "", /скопируйте промт/i);
  assert.doesNotMatch(seo.explorerIntro ?? "", /идеи/i);
  assert.equal(seo.howToTitle, "Как использовать промт для осеннего фото");
  assert.doesNotMatch(seo.howToTitle ?? "", /фотосессии|идеи/i);
  assert.ok(seo.faqItems.some((item) => /промт для осенней фотосессии/i.test(item.q)));
  assert.equal(
    seo.faqItems.filter((item) => /промт для осенней фотосессии/i.test(item.q)).length,
    1,
  );
  assert.equal(seo.popularLinks?.length ?? 0, 0);
  assert.equal(seo.seoTextBlocks?.length ?? 0, 0);
  const copy = `${seo.h1} ${seo.intro} ${seo.explorerTitle} ${seo.explorerIntro} ${seo.howToTitle} ${seo.faqItems.map((item) => item.q).join(" ")}`;
  assert.doesNotMatch(copy, FORBIDDEN_EXTERNAL_CTA);
});

test("uniform hub keeps military form in the head and с военным in explorer", () => {
  const route = resolveUrlToTags(["v-forme"]);
  assert.ok(route);

  const seo = getSeoForRoute(route);
  assert.equal(seo.h1, "Промты для фото в военной форме");
  assert.equal(
    seo.metaTitle,
    "Промты для фото в военной форме 🪖 — 300+ готовых промтов на русском 🇷🇺",
  );
  assert.doesNotMatch(seo.h1, /300\+|с военным/i);
  assert.match(seo.intro, /промты для ии фотосессии с военным/i);
  assert.doesNotMatch(seo.intro, /в военной форме|промт для фото с военным/i);
  assert.equal(seo.explorerTitle, "Промт для фото с военным");
  assert.doesNotMatch(seo.explorerTitle ?? "", /военной форме|фотошоп/i);
  assert.match(seo.explorerIntro ?? "", /скопируйте промт/i);
  assert.doesNotMatch(seo.explorerIntro ?? "", /военной форме/i);
  assert.equal(seo.howToTitle, "Как использовать промт для фото военного");
  assert.doesNotMatch(seo.howToTitle ?? "", /с мужем|фотошоп/i);
  assert.ok(
    seo.faqItems.some((item) => /промт для фото с мужем военным/i.test(item.q)),
  );
  assert.equal(
    seo.faqItems.filter((item) => /промт для фото с мужем военным/i.test(item.q))
      .length,
    1,
  );
  assert.equal(seo.popularLinks?.length ?? 0, 0);
  assert.equal(seo.seoTextBlocks?.length ?? 0, 0);
  const copy = `${seo.h1} ${seo.intro} ${seo.explorerTitle} ${seo.explorerIntro} ${seo.howToTitle} ${seo.faqItems.map((item) => item.q).join(" ")}`;
  assert.doesNotMatch(copy, FORBIDDEN_EXTERNAL_CTA);
  assert.doesNotMatch(copy, /фотошоп/i);
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

test("forest hub keeps в лесу in the head and фотосессии in explorer", () => {
  const route = resolveUrlToTags(["promty-dlya-foto", "v-lesu"]);
  assert.ok(route);
  assert.equal(route.canonicalPath, "/promty-dlya-foto/v-lesu");
  assert.equal(route.rpcParams.object_tag, "v_lesu");
  assert.equal(resolveUrlToTags(["v-lesu"]), null);

  const seo = getSeoForRoute(route);
  assert.equal(seo.h1, "Промты для фото в лесу");
  assert.equal(
    seo.metaTitle,
    "Промты для фото в лесу 🌲 — 600+ готовых промтов на русском 🇷🇺",
  );
  assert.doesNotMatch(seo.h1, /600\+|фотосесс|портрет/i);
  assert.match(seo.intro, /среди деревьев/i);
  assert.doesNotMatch(seo.intro, /фотосесс|портрет|кинематограф/i);
  assert.equal(seo.explorerTitle, "Промпт для фотосессии в лесу");
  assert.equal(seo.howToTitle, "Как использовать промт для кинематографичного кадра");
  assert.equal(
    seo.faqItems.filter((item) => /портрета в лесу/i.test(item.q)).length,
    1,
  );
  assert.equal(seo.popularLinks?.length ?? 0, 0);
});

test("horse hub keeps с лошадью in the head and коня in explorer", () => {
  const route = resolveUrlToTags(["promty-dlya-foto", "s-loshadyu"]);
  assert.ok(route);
  assert.equal(route.canonicalPath, "/promty-dlya-foto/s-loshadyu");
  assert.equal(route.rpcParams.object_tag, "s_loshadyu");
  assert.equal(resolveUrlToTags(["s-loshadyu"]), null);

  const seo = getSeoForRoute(route);
  assert.equal(seo.h1, "Промты для фото с лошадью");
  assert.equal(
    seo.metaTitle,
    "Промты для фото с лошадью 🐴 — 70+ готовых промтов на русском 🇷🇺",
  );
  assert.doesNotMatch(seo.h1, /70\+|коня|седл/i);
  assert.match(seo.intro, /кадра верхом/i);
  assert.doesNotMatch(seo.intro, /коня|седл/i);
  assert.equal(seo.explorerTitle, "Промт для фотосессии коня");
  assert.equal(seo.howToTitle, "Как использовать промт в седле");
  assert.equal(
    seo.faqItems.filter((item) => /промт с лошадью/i.test(item.q)).length,
    1,
  );
  assert.equal(seo.popularLinks?.length ?? 0, 0);
});

test("cake hub keeps с тортом in the head and день рождения in explorer", () => {
  const route = resolveUrlToTags(["promty-dlya-foto", "s-tortom"]);
  assert.ok(route);
  assert.equal(route.canonicalPath, "/promty-dlya-foto/s-tortom");
  assert.equal(route.rpcParams.object_tag, "s_tortom");
  assert.equal(resolveUrlToTags(["s-tortom"]), null);

  const seo = getSeoForRoute(route);
  assert.equal(seo.h1, "Промты для фото с тортом");
  assert.equal(
    seo.metaTitle,
    "Промты для фото с тортом 🎂 — 200+ готовых промтов на русском 🇷🇺",
  );
  assert.doesNotMatch(seo.h1, /200\+|день рождения|свеч/i);
  assert.match(seo.intro, /кадра с десертом/i);
  assert.doesNotMatch(seo.intro, /день рождения|свеч/i);
  assert.equal(seo.explorerTitle, "Промт для фото на день рождения девушке с тортом");
  assert.equal(seo.howToTitle, "Как использовать промт со свечами");
  assert.equal(
    seo.faqItems.filter((item) => /промт для фото с тортом/i.test(item.q)).length,
    1,
  );
  assert.equal(seo.popularLinks?.length ?? 0, 0);
});

test("motorcycle hub keeps на мотоцикле in the head and фотосессия in explorer", () => {
  const route = resolveUrlToTags(["promty-dlya-foto", "mototsikl"]);
  assert.ok(route);
  assert.equal(route.canonicalPath, "/promty-dlya-foto/mototsikl");
  assert.equal(route.rpcParams.object_tag, "mototsikl");
  assert.equal(resolveUrlToTags(["mototsikl"]), null);

  const seo = getSeoForRoute(route);
  assert.equal(seo.h1, "Промты для фото на мотоцикле");
  assert.equal(
    seo.metaTitle,
    "Промты для фото на мотоцикле 🏍️ — 30+ готовых промтов на русском 🇷🇺",
  );
  assert.doesNotMatch(seo.h1, /30\+|фотосесс|байк/i);
  assert.match(seo.intro, /кадра на байке/i);
  assert.doesNotMatch(seo.intro, /фотосесс|с мотоциклом/i);
  assert.equal(seo.explorerTitle, "Промты для фотосессии на мотоцикле");
  assert.equal(seo.howToTitle, "Как использовать промт мотоциклиста");
  assert.equal(
    seo.faqItems.filter((item) => /промт с мотоциклом/i.test(item.q)).length,
    1,
  );
  assert.equal(seo.popularLinks?.length ?? 0, 0);
});

test("gym hub keeps спортзале in the head and фитнес in explorer", () => {
  const route = resolveUrlToTags(["promty-dlya-foto", "v-sportale"]);
  assert.ok(route);
  assert.equal(route.canonicalPath, "/promty-dlya-foto/v-sportale");
  assert.equal(route.rpcParams.object_tag, "v_sportale");
  assert.equal(resolveUrlToTags(["v-sportale"]), null);

  const seo = getSeoForRoute(route);
  assert.equal(seo.h1, "Промты для фото в спортзале");
  assert.equal(
    seo.metaTitle,
    "Промты для фото в спортзале 🏋️ — 50+ готовых промтов на русском 🇷🇺",
  );
  assert.doesNotMatch(seo.h1, /50\+|фитнес|девушк/i);
  assert.match(seo.intro, /тренажёрном зале/i);
  assert.doesNotMatch(seo.intro, /фитнес|девушки на спорте/i);
  assert.equal(seo.explorerTitle, "Промт для фото в фитнесе");
  assert.equal(seo.howToTitle, "Как использовать промт для тренировочного кадра");
  assert.equal(
    seo.faqItems.filter((item) => /девушки на спорте/i.test(item.q)).length,
    1,
  );
  assert.equal(seo.popularLinks?.length ?? 0, 0);
});

test("mirror hub keeps в зеркале in the head and с парнем in explorer", () => {
  const route = resolveUrlToTags(["promty-dlya-foto", "v-zerkale"]);
  assert.ok(route);
  assert.equal(route.canonicalPath, "/promty-dlya-foto/v-zerkale");
  assert.equal(route.rpcParams.object_tag, "v_zerkale");
  assert.equal(resolveUrlToTags(["v-zerkale"]), null);

  const seo = getSeoForRoute(route);
  assert.equal(seo.h1, "Промты для фото в зеркале");
  assert.equal(
    seo.metaTitle,
    "Промты для фото в зеркале 🪞 — 300+ готовых промтов на русском 🇷🇺",
  );
  assert.doesNotMatch(seo.h1, /300\+|парнем|селфи/i);
  assert.match(seo.intro, /напротив зеркала/i);
  assert.doesNotMatch(seo.intro, /парнем|селфи|отражени/i);
  assert.equal(seo.explorerTitle, "Промт для фото в зеркале с парнем");
  assert.equal(seo.howToTitle, "Как использовать промт для отражения");
  assert.equal(
    seo.faqItems.filter((item) => /промт селфи в зеркале/i.test(item.q)).length,
    1,
  );
  assert.equal(seo.popularLinks?.length ?? 0, 0);
});

test("champagne hub keeps шампанским in the head and брызги in explorer", () => {
  const route = resolveUrlToTags(["promty-dlya-foto", "s-shampanskim"]);
  assert.ok(route);
  assert.equal(route.canonicalPath, "/promty-dlya-foto/s-shampanskim");
  assert.equal(route.rpcParams.object_tag, "s_shampanskim");
  assert.equal(resolveUrlToTags(["s-shampanskim"]), null);

  const seo = getSeoForRoute(route);
  assert.equal(seo.h1, "Промты для фото с шампанским");
  assert.equal(
    seo.metaTitle,
    "Промты для фото с шампанским 🍾 — 90+ готовых промтов на русском 🇷🇺",
  );
  assert.doesNotMatch(seo.h1, /90\+|брызг/i);
  assert.match(seo.intro, /праздничного кадра с игристым/i);
  assert.doesNotMatch(seo.intro, /брызг|промт с шампанским/i);
  assert.equal(seo.explorerTitle, "Промт для фото в стиле брызги шампанского");
  assert.equal(seo.howToTitle, "Как использовать промт для праздничного кадра");
  assert.equal(
    seo.faqItems.filter((item) => /промт с шампанским/i.test(item.q)).length,
    1,
  );
  assert.equal(seo.popularLinks?.length ?? 0, 0);
});

test("in-car hub keeps в машине in the head and фотосессия in explorer", () => {
  const route = resolveUrlToTags(["promty-dlya-foto", "v-mashine"]);
  assert.ok(route);
  assert.equal(route.canonicalPath, "/promty-dlya-foto/v-mashine");
  assert.equal(route.rpcParams.object_tag, "v_mashine");
  assert.equal(resolveUrlToTags(["v-mashine"]), null);

  const seo = getSeoForRoute(route);
  assert.equal(seo.h1, "Промты для фото в машине");
  assert.equal(
    seo.metaTitle,
    "Промты для фото в машине 🚘 — 100+ готовых промтов на русском 🇷🇺",
  );
  assert.doesNotMatch(seo.h1, /100\+|фотосессия/i);
  assert.match(seo.intro, /кадра за рулём/i);
  assert.doesNotMatch(seo.intro, /фотосессия|для машины/i);
  assert.equal(seo.explorerTitle, "Промт фотосессия в машине");
  assert.equal(seo.howToTitle, "Как использовать промт за рулём");
  assert.equal(
    seo.faqItems.filter((item) => /промт для машины/i.test(item.q)).length,
    1,
  );
  assert.equal(seo.popularLinks?.length ?? 0, 0);
});

test("sea hub keeps море in the head and пляж in explorer", () => {
  const route = resolveUrlToTags(["promty-dlya-foto", "na-more"]);
  assert.ok(route);
  assert.equal(route.canonicalPath, "/promty-dlya-foto/na-more");
  assert.equal(route.rpcParams.object_tag, "na_more");
  assert.equal(resolveUrlToTags(["na-more"]), null);

  const seo = getSeoForRoute(route);
  assert.equal(seo.h1, "Промты для фото на море");
  assert.equal(
    seo.metaTitle,
    "Промты для фото на море 🌊 — 400+ готовых промтов на русском 🇷🇺",
  );
  assert.doesNotMatch(seo.h1, /400\+|пляже/i);
  assert.match(seo.intro, /кадра на побережье/i);
  assert.doesNotMatch(seo.intro, /фото на море|на пляже/i);
  assert.equal(seo.explorerTitle, "Промт для фото на пляже");
  assert.doesNotMatch(seo.explorerTitle ?? "", /на море/i);
  assert.match(seo.explorerIntro ?? "", /скопируйте промт/i);
  assert.doesNotMatch(seo.explorerIntro ?? "", /пляже/i);
  assert.equal(seo.howToTitle, "Как использовать промт для морского фото");
  assert.doesNotMatch(seo.howToTitle ?? "", /на море|на пляже/i);
  assert.equal(
    seo.faqItems.filter((item) => /промт на море/i.test(item.q)).length,
    1,
  );
  assert.equal(seo.popularLinks?.length ?? 0, 0);
  assert.equal(seo.seoTextBlocks?.length ?? 0, 0);
  const copy = `${seo.h1} ${seo.intro} ${seo.explorerTitle} ${seo.explorerIntro} ${seo.howToTitle} ${seo.faqItems.map((item) => item.q).join(" ")}`;
  assert.doesNotMatch(copy, FORBIDDEN_EXTERNAL_CTA);
  assert.doesNotMatch(copy, /фотошоп|пинтерест|instagram/i);
});

test("avatar hub keeps аватарку in the head and профиль in explorer", () => {
  const route = resolveUrlToTags(["promty-dlya-foto", "na-avatarku"]);
  assert.ok(route);
  assert.equal(route.canonicalPath, "/promty-dlya-foto/na-avatarku");
  assert.equal(route.rpcParams.object_tag, "na_avatarku");
  assert.equal(resolveUrlToTags(["foto-na-avatarku"]), null);

  const seo = getSeoForRoute(route);
  assert.equal(seo.h1, "Промты для фото на аватарку");
  assert.equal(
    seo.metaTitle,
    "Промты для фото на аватарку 🖼️ — 80+ готовых промтов на русском 🇷🇺",
  );
  assert.doesNotMatch(seo.h1, /80\+|профиля/i);
  assert.match(seo.intro, /промты для аватарки/i);
  assert.doesNotMatch(seo.intro, /фото на аватарку|фото профиля/i);
  assert.equal(seo.explorerTitle, "Промты для фото профиля");
  assert.doesNotMatch(seo.explorerTitle ?? "", /аватарк/i);
  assert.match(seo.explorerIntro ?? "", /скопируйте промт/i);
  assert.doesNotMatch(seo.explorerIntro ?? "", /профиля/i);
  assert.equal(seo.howToTitle, "Как использовать промт на аватарку");
  assert.doesNotMatch(seo.howToTitle ?? "", /для авы|фото профиля/i);
  assert.equal(
    seo.faqItems.filter((item) => /промт для авы/i.test(item.q)).length,
    1,
  );
  assert.equal(seo.popularLinks?.length ?? 0, 0);
  assert.equal(seo.seoTextBlocks?.length ?? 0, 0);
  const copy = `${seo.h1} ${seo.intro} ${seo.explorerTitle} ${seo.explorerIntro} ${seo.howToTitle} ${seo.faqItems.map((item) => item.q).join(" ")}`;
  assert.doesNotMatch(copy, FORBIDDEN_EXTERNAL_CTA);
  assert.doesNotMatch(copy, /nano banana|инстаграм/i);
});

test("car hub keeps с машиной in the head and фото машины in explorer", () => {
  const route = resolveUrlToTags(["promty-dlya-foto", "s-mashinoy"]);
  assert.ok(route);
  assert.equal(route.canonicalPath, "/promty-dlya-foto/s-mashinoy");
  assert.equal(route.rpcParams.object_tag, "s_mashinoy");
  assert.equal(resolveUrlToTags(["s-mashinoy"]), null);

  const seo = getSeoForRoute(route);
  assert.equal(seo.h1, "Промты для фото с машиной");
  assert.equal(
    seo.metaTitle,
    "Промты для фото с машиной 🚗 — 500+ готовых промтов на русском 🇷🇺",
  );
  assert.doesNotMatch(seo.h1, /500\+|фото машины/i);
  assert.match(seo.intro, /промты для ии фото с автомобилем/i);
  assert.doesNotMatch(seo.intro, /фото с машиной|фото машины/i);
  assert.equal(seo.explorerTitle, "Промт для фото машины");
  assert.doesNotMatch(seo.explorerTitle ?? "", /с машиной|мужск/i);
  assert.match(seo.explorerIntro ?? "", /скопируйте промт/i);
  assert.doesNotMatch(seo.explorerIntro ?? "", /фото машины/i);
  assert.equal(seo.howToTitle, "Как использовать промт для автомобиля");
  assert.doesNotMatch(seo.howToTitle ?? "", /с машиной|фото машины/i);
  assert.ok(seo.faqItems.some((item) => /промт на фото с машиной/i.test(item.q)));
  assert.equal(
    seo.faqItems.filter((item) => /промт на фото с машиной/i.test(item.q)).length,
    1,
  );
  assert.equal(seo.popularLinks?.length ?? 0, 0);
  assert.equal(seo.seoTextBlocks?.length ?? 0, 0);
  const copy = `${seo.h1} ${seo.intro} ${seo.explorerTitle} ${seo.explorerIntro} ${seo.howToTitle} ${seo.faqItems.map((item) => item.q).join(" ")}`;
  assert.doesNotMatch(copy, FORBIDDEN_EXTERNAL_CTA);
  assert.doesNotMatch(copy, /фотошоп|сирен|nano banana/i);
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
