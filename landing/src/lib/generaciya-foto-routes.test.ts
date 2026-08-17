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
      "na-den-rozhdeniya",
      "semya",
      "devushki",
      "s-mashinoy",
      "muzhchiny",
      "malysh",
      "v-forme",
      "deti",
      "s-dochkoy",
      "na-more",
      "s-mamoy",
      "cherno-beloe",
      "s-podrugoy",
      "s-shampanskim",
      "selfi",
      "beremennaya",
      "studiynoe",
      "v-zerkale",
      "kollazh",
      "portret",
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
});
