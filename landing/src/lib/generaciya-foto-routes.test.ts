import assert from "node:assert/strict";
import test from "node:test";
import {
  GENERACIYA_FOTO_SCENARIO_ROUTES,
  findGeneraciyaFotoScenarioByTag,
  findGeneraciyaFotoScenarioRoute,
  generaciyaLegacyRedirectPath,
  getGeneraciyaFotoScenarioPath,
  generaciyaSeoImagePaths,
  isGeneraciyaFotoScenarioPath,
  isGeneraciyaHubPath,
  isGeneraciyaSeoImagePath,
} from "./generaciya-foto-routes";
import {
  GENERACIYA_FOTO_SCENARIO_COPY,
  getGeneraciyaFotoScenarioStarterPrompt,
} from "./generaciya-foto-scenario-copy";

test("generation scenario routes cover every hub chip and core SEO page", () => {
  assert.deepEqual(
    GENERACIYA_FOTO_SCENARIO_ROUTES.map(({ slug }) => slug),
    [
      "pary",
      "devushki",
      "na-den-rozhdeniya",
      "muzhchiny",
      "semya",
      "deti",
      "v-forme",
      "s-mashinoy",
      "malysh",
      "studiynoe",
      "na-more",
      "s-podrugoy",
      "s-dochkoy",
      "selfi",
      "beremennaya",
      "cherno-beloe",
      "portret",
      "s-mamoy",
      "s-shampanskim",
      "v-zerkale",
      "kollazh",
      "anime",
    ]
  );
});

test("SEO image stack is limited to the three hubs and 22 scenarios", () => {
  const paths = generaciyaSeoImagePaths();
  assert.equal(paths.length, 25);
  assert.equal(new Set(paths).size, 25);
  for (const path of paths) {
    assert.equal(isGeneraciyaSeoImagePath(path), true);
    assert.equal(isGeneraciyaSeoImagePath(`${path}/`), true);
  }
  assert.equal(isGeneraciyaSeoImagePath("/generaciya/foto-po-opisaniyu"), true);
  assert.equal(isGeneraciyaSeoImagePath("/generaciya/kartinka-po-opisaniyu"), true);
  assert.equal(isGeneraciyaSeoImagePath("/generaciya/po-foto"), true);
  for (const route of GENERACIYA_FOTO_SCENARIO_ROUTES) {
    assert.equal(
      isGeneraciyaSeoImagePath(getGeneraciyaFotoScenarioPath(route.slug)),
      true,
    );
  }
  assert.equal(isGeneraciyaSeoImagePath("/generaciya/po-foto/neizvestno"), false);
  assert.equal(isGeneraciyaSeoImagePath("/promty-dlya-foto-devushki"), false);
  assert.equal(isGeneraciyaSeoImagePath("/p/portret-u-okna"), false);
  assert.equal(isGeneraciyaSeoImagePath("/"), false);
});

test("generation scenario paths use an explicit allowlist", () => {
  assert.equal(isGeneraciyaFotoScenarioPath("/generaciya/po-foto/devushki"), true);
  assert.equal(isGeneraciyaFotoScenarioPath("/generaciya/po-foto/deti/"), true);
  assert.equal(isGeneraciyaFotoScenarioPath("/generaciya/po-foto/na-pasport"), false);
  assert.equal(isGeneraciyaFotoScenarioPath("/generaciya/po-foto/pricheski"), false);
  assert.equal(
    isGeneraciyaFotoScenarioPath("/generaciya/po-foto/dlya-marketpleysov"),
    false
  );
  assert.equal(findGeneraciyaFotoScenarioRoute("unknown"), null);
});

test("legacy /generaciya-foto* paths 301 into the /generaciya section", () => {
  assert.equal(generaciyaLegacyRedirectPath("/generaciya-foto"), "/generaciya/foto-po-opisaniyu");
  assert.equal(generaciyaLegacyRedirectPath("/generaciya-foto/"), "/generaciya/foto-po-opisaniyu");
  assert.equal(generaciyaLegacyRedirectPath("/generaciya"), "/generaciya/foto-po-opisaniyu");
  assert.equal(
    generaciyaLegacyRedirectPath("/generaciya-foto/na-den-rozhdeniya"),
    "/generaciya/po-foto/na-den-rozhdeniya"
  );
  assert.equal(generaciyaLegacyRedirectPath("/generaciya-foto/pary/"), "/generaciya/po-foto/pary");
  // Unknown legacy child → photo hub, not 404.
  assert.equal(generaciyaLegacyRedirectPath("/generaciya-foto/neizvestno"), "/generaciya/po-foto");
  // Section pages themselves are not redirected.
  assert.equal(generaciyaLegacyRedirectPath("/generaciya/foto-po-opisaniyu"), null);
  assert.equal(generaciyaLegacyRedirectPath("/generaciya/kartinka-po-opisaniyu"), null);
  assert.equal(generaciyaLegacyRedirectPath("/generaciya/po-foto/pary"), null);
  assert.equal(generaciyaLegacyRedirectPath("/generaciya-fotograf"), null);
  assert.equal(isGeneraciyaHubPath("/generaciya/po-foto/"), true);
  assert.equal(isGeneraciyaHubPath("/generaciya/po-foto/pary"), false);
  assert.equal(isGeneraciyaHubPath("/generaciya-foto"), false);
});

test("generation scenarios map to existing tag dimensions", () => {
  assert.equal(
    findGeneraciyaFotoScenarioByTag("audience_tag", "muzhchina")?.slug,
    "muzhchiny"
  );
  assert.equal(
    findGeneraciyaFotoScenarioByTag("style_tag", "anime")?.slug,
    "anime"
  );
  assert.equal(
    getGeneraciyaFotoScenarioPath("na-den-rozhdeniya"),
    "/generaciya/po-foto/na-den-rozhdeniya"
  );
});

test("birthday generation page owns the generate query", () => {
  const copy = GENERACIYA_FOTO_SCENARIO_COPY.find(
    (scenario) => scenario.slug === "na-den-rozhdeniya",
  );
  assert.ok(copy);
  assert.match(copy.metaTitle, /Сделать ИИ фото на день рождения/);
  assert.equal(copy.h1, "Сделать ИИ фото на день рождения");
  assert.match(
    `${copy.intro} ${copy.faq.map((item) => `${item.q} ${item.a}`).join(" ")}`,
    /сгенерировать фото на день рождения/i,
  );
});

test("every scenario has unique, complete SEO copy", () => {
  assert.equal(GENERACIYA_FOTO_SCENARIO_COPY.length, 22);
  assert.equal(
    new Set(GENERACIYA_FOTO_SCENARIO_COPY.map(({ slug }) => slug)).size,
    22
  );
  assert.equal(
    new Set(GENERACIYA_FOTO_SCENARIO_COPY.map(({ metaTitle }) => metaTitle))
      .size,
    22
  );
  assert.equal(
    new Set(GENERACIYA_FOTO_SCENARIO_COPY.map(({ h1 }) => h1)).size,
    22
  );

  const MANUAL_DESCRIPTION_SLUGS = new Set([
    "na-den-rozhdeniya",
    "semya",
    "deti",
    "beremennaya",
    "pary",
  ]);

  for (const scenario of GENERACIYA_FOTO_SCENARIO_COPY) {
    assert.ok(scenario.metaDescription.length >= 100);
    assert.ok(scenario.metaDescription.length <= 160);
    if (MANUAL_DESCRIPTION_SLUGS.has(scenario.slug)) {
      assert.equal(scenario.metaDescriptionManual, true);
    } else {
      assert.match(scenario.metaDescription, /снимку или описанию/);
    }
    assert.doesNotMatch(scenario.h1, /по промту или снимку/);
    assert.match(scenario.intro, /^Выберите готовый образ /);
    assert.equal(scenario.howToSteps.length, 4);
    assert.ok(scenario.faq.length >= 3);
    assert.ok(scenario.contentBlocks.length >= 1);
    assert.match(scenario.promptCatalogHref, /^\//);
    assert.match(
      getGeneraciyaFotoScenarioStarterPrompt(scenario),
      /^Создай /
    );
  }

  const women = GENERACIYA_FOTO_SCENARIO_COPY.find(
    (scenario) => scenario.slug === "devushki"
  );
  const men = GENERACIYA_FOTO_SCENARIO_COPY.find(
    (scenario) => scenario.slug === "muzhchiny"
  );
  assert.equal(women?.promptCatalogHref, "/ii-fotosessiya/zhenskie");
  assert.equal(men?.promptCatalogHref, "/ii-fotosessiya/muzhskie");

  const pairs = GENERACIYA_FOTO_SCENARIO_COPY.find(
    (scenario) => scenario.slug === "pary"
  );
  const family = GENERACIYA_FOTO_SCENARIO_COPY.find(
    (scenario) => scenario.slug === "semya"
  );
  const kids = GENERACIYA_FOTO_SCENARIO_COPY.find(
    (scenario) => scenario.slug === "deti"
  );
  const pregnancy = GENERACIYA_FOTO_SCENARIO_COPY.find(
    (scenario) => scenario.slug === "beremennaya"
  );
  assert.equal(pairs?.promptCatalogHref, "/ii-fotosessiya/pary");
  assert.equal(
    pairs?.metaDescription,
    "ИИ фото для пары: прогулка, студия или праздник. Загрузите два снимка или опишите кадр — результат без фотографа."
  );
  assert.equal(family?.promptCatalogHref, "/ii-fotosessiya/semeynye");
  assert.equal(
    family?.metaDescription,
    "Семейное ИИ фото: дома, в студии или на празднике. Загрузите снимки или опишите состав семьи — кадр без студии."
  );
  assert.equal(family?.contentBlocks[0]?.h2, "Как сделать семейное ИИ фото");
  assert.equal(kids?.promptCatalogHref, "/ii-fotosessiya/detskie");
  assert.equal(
    kids?.metaDescription,
    "Детское ИИ фото: праздник, портрет или прогулка. Загрузите снимок или опишите кадр — результат без студии."
  );
  assert.equal(
    pregnancy?.promptCatalogHref,
    "/ii-fotosessiya/beremennye"
  );
  assert.equal(
    pregnancy?.metaDescription,
    "ИИ фото беременности: студийный или домашний кадр. Загрузите свой снимок или опишите образ — без студии и фотографа."
  );
  assert.equal(
    GENERACIYA_FOTO_SCENARIO_COPY.find((scenario) => scenario.slug === "s-mashinoy")
      ?.promptCatalogHref,
    "/ii-fotosessiya/s-mashinoy"
  );
  assert.equal(
    GENERACIYA_FOTO_SCENARIO_COPY.find((scenario) => scenario.slug === "malysh")
      ?.promptCatalogHref,
    "/ii-fotosessiya/nyuborn"
  );
  assert.equal(
    GENERACIYA_FOTO_SCENARIO_COPY.find((scenario) => scenario.slug === "v-forme")
      ?.promptCatalogHref,
    "/ii-fotosessiya/s-voennymi"
  );
  assert.equal(
    GENERACIYA_FOTO_SCENARIO_COPY.find((scenario) => scenario.slug === "studiynoe")
      ?.promptCatalogHref,
    "/ii-fotosessiya/studiynye"
  );
  assert.equal(
    GENERACIYA_FOTO_SCENARIO_COPY.find((scenario) => scenario.slug === "cherno-beloe")
      ?.promptCatalogHref,
    "/ii-fotosessiya/cherno-belye"
  );
});
