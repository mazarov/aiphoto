import assert from "node:assert/strict";
import test from "node:test";
import {
  GENERACIYA_FOTO_SCENARIO_ROUTES,
  findGeneraciyaFotoScenarioByTag,
  findGeneraciyaFotoScenarioRoute,
  getGeneraciyaFotoScenarioPath,
  isGeneraciyaFotoScenarioPath,
} from "./generaciya-foto-routes";
import { GENERACIYA_FOTO_SCENARIO_COPY } from "./generaciya-foto-scenario-copy";

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

test("generation scenario paths use an explicit allowlist", () => {
  assert.equal(isGeneraciyaFotoScenarioPath("/generaciya-foto/devushki"), true);
  assert.equal(isGeneraciyaFotoScenarioPath("/generaciya-foto/deti/"), true);
  assert.equal(isGeneraciyaFotoScenarioPath("/generaciya-foto/na-pasport"), false);
  assert.equal(isGeneraciyaFotoScenarioPath("/generaciya-foto/pricheski"), false);
  assert.equal(
    isGeneraciyaFotoScenarioPath("/generaciya-foto/dlya-marketpleysov"),
    false
  );
  assert.equal(findGeneraciyaFotoScenarioRoute("unknown"), null);
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
    "/generaciya-foto/na-den-rozhdeniya"
  );
});

test("birthday generation page owns the generate query", () => {
  const copy = GENERACIYA_FOTO_SCENARIO_COPY.find(
    (scenario) => scenario.slug === "na-den-rozhdeniya",
  );
  assert.ok(copy);
  assert.match(copy.metaTitle, /Сгенерировать фото на день рождения/);
  assert.match(copy.h1, /Сгенерировать фото на день рождения/);
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

  for (const scenario of GENERACIYA_FOTO_SCENARIO_COPY) {
    assert.ok(scenario.metaDescription.length >= 100);
    assert.equal(scenario.howToSteps.length, 4);
    assert.ok(scenario.faq.length >= 3);
    assert.ok(scenario.contentBlocks.length >= 1);
    assert.match(scenario.promptCatalogHref, /^\//);
  }

  const women = GENERACIYA_FOTO_SCENARIO_COPY.find(
    (scenario) => scenario.slug === "devushki"
  );
  const men = GENERACIYA_FOTO_SCENARIO_COPY.find(
    (scenario) => scenario.slug === "muzhchiny"
  );
  assert.equal(women?.promptCatalogHref, "/promty-dlya-ii-fotosessii/zhenskie");
  assert.equal(men?.promptCatalogHref, "/promty-dlya-ii-fotosessii/muzhskie");

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
  assert.equal(pairs?.promptCatalogHref, "/promty-dlya-ii-fotosessii/pary");
  assert.equal(family?.promptCatalogHref, "/promty-dlya-ii-fotosessii/semeynye");
  assert.equal(kids?.promptCatalogHref, "/promty-dlya-ii-fotosessii/detskie");
  assert.equal(
    pregnancy?.promptCatalogHref,
    "/promty-dlya-ii-fotosessii/beremennye"
  );
  assert.equal(
    GENERACIYA_FOTO_SCENARIO_COPY.find((scenario) => scenario.slug === "s-mashinoy")
      ?.promptCatalogHref,
    "/promty-dlya-ii-fotosessii/s-mashinoy"
  );
  assert.equal(
    GENERACIYA_FOTO_SCENARIO_COPY.find((scenario) => scenario.slug === "malysh")
      ?.promptCatalogHref,
    "/promty-dlya-ii-fotosessii/nyuborn"
  );
  assert.equal(
    GENERACIYA_FOTO_SCENARIO_COPY.find((scenario) => scenario.slug === "v-forme")
      ?.promptCatalogHref,
    "/promty-dlya-ii-fotosessii/s-voennymi"
  );
  assert.equal(
    GENERACIYA_FOTO_SCENARIO_COPY.find((scenario) => scenario.slug === "studiynoe")
      ?.promptCatalogHref,
    "/promty-dlya-ii-fotosessii/studiynye"
  );
  assert.equal(
    GENERACIYA_FOTO_SCENARIO_COPY.find((scenario) => scenario.slug === "cherno-beloe")
      ?.promptCatalogHref,
    "/promty-dlya-ii-fotosessii/cherno-belye"
  );
});
