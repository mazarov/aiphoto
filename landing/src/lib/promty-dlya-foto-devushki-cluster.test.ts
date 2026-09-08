import assert from "node:assert/strict";
import test from "node:test";
import {
  GENERACIYA_FOTO_DEVUSHKI_PATH,
  GIRLS_HUB_AUDIENCE_TAG,
  GIRLS_HUB_COMPOSE_EXAMPLE_FILTER,
  GIRLS_HUB_FILTER_CHIPS,
  GIRLS_HUB_GENERATE_CTA,
  GIRLS_HUB_HERO_ARIA_LABEL,
  GIRLS_HUB_HERO_CARD_LIMIT,
  GIRLS_HUB_LOAD_MORE_LABEL,
  PROMTY_DLYA_FOTO_DEVUSHKI_HUB_PATH,
  getGirlsHubFilterNavItems,
  girlsChildRedirectPath,
  girlsHubFilterHref,
  girlsHubHeroFetchParams,
  isGeneraciyaFotoDevushkiPath,
  isGirlsHubBirthdayOwnedPath,
  isPromtyDlyaFotoDevushkiClusterPath,
  isPromtyDlyaFotoDevushkiHubPath,
  toGirlsHubHeroCarouselCards,
} from "./promty-dlya-foto-devushki-cluster";

test("hub path stays under /promty-dlya-foto-devushki", () => {
  assert.equal(PROMTY_DLYA_FOTO_DEVUSHKI_HUB_PATH, "/promty-dlya-foto-devushki");
  assert.equal(isPromtyDlyaFotoDevushkiHubPath("/promty-dlya-foto-devushki"), true);
  assert.equal(isPromtyDlyaFotoDevushkiHubPath("/promty-dlya-foto-devushki/"), true);
  assert.equal(
    isPromtyDlyaFotoDevushkiClusterPath("/promty-dlya-foto-devushki/s-cvetami"),
    true,
  );
  assert.equal(isPromtyDlyaFotoDevushkiHubPath("/promty-dlya-foto-par"), false);
  assert.equal(isGeneraciyaFotoDevushkiPath(GENERACIYA_FOTO_DEVUSHKI_PATH), true);
  assert.equal(isGeneraciyaFotoDevushkiPath("/generaciya-foto/devushki/"), true);
  assert.equal(isGeneraciyaFotoDevushkiPath("/generaciya-foto/pary"), false);
});

test("plot L2 consolidates into the hub; birthday tails stay out", () => {
  assert.equal(girlsChildRedirectPath("/promty-dlya-foto-devushki"), null);
  assert.equal(girlsChildRedirectPath("/promty-dlya-foto-devushki/"), null);
  assert.equal(
    girlsChildRedirectPath("/promty-dlya-foto-devushki/s-cvetami"),
    PROMTY_DLYA_FOTO_DEVUSHKI_HUB_PATH,
  );
  assert.equal(
    girlsChildRedirectPath("/promty-dlya-foto-devushki/portret/"),
    PROMTY_DLYA_FOTO_DEVUSHKI_HUB_PATH,
  );
  assert.equal(
    girlsChildRedirectPath("/promty-dlya-foto-devushki/den-rozhdeniya"),
    null,
  );
  assert.equal(
    girlsChildRedirectPath("/promty-dlya-foto-devushki/den-rozhdeniya/s-tortom"),
    null,
  );
  assert.equal(
    girlsChildRedirectPath("/promty-dlya-foto-devushki/s-cvetami/den-rozhdeniya"),
    null,
  );
  assert.equal(
    isGirlsHubBirthdayOwnedPath("/promty-dlya-foto-devushki/den-rozhdeniya"),
    true,
  );
});

test("hub filters stay on the hub as query params", () => {
  assert.equal(girlsHubFilterHref(null), PROMTY_DLYA_FOTO_DEVUSHKI_HUB_PATH);
  for (const chip of GIRLS_HUB_FILTER_CHIPS) {
    const href = girlsHubFilterHref(chip);
    assert.equal(href.startsWith(`${PROMTY_DLYA_FOTO_DEVUSHKI_HUB_PATH}?`), true);
    assert.equal(href.includes(`/${chip.value}`), false);
    assert.equal(girlsChildRedirectPath(href.split("?")[0] ?? href), null);
  }

  const items = getGirlsHubFilterNavItems({ object: "s_cvetami" });
  assert.equal(items[0]?.label, "Все");
  assert.equal(items[0]?.active, false);
  assert.equal(
    items.find((item) => item.label === "С цветами")?.active,
    true,
  );
  assert.equal(
    items.find((item) => item.label === "С цветами")?.href,
    `${PROMTY_DLYA_FOTO_DEVUSHKI_HUB_PATH}?object=s_cvetami`,
  );
  assert.equal(GIRLS_HUB_LOAD_MORE_LABEL, "Больше промтов для девушки");
  assert.equal(GIRLS_HUB_GENERATE_CTA, "Создать фото девушки");
  assert.deepEqual(GIRLS_HUB_COMPOSE_EXAMPLE_FILTER, {
    label: "Девушки",
    dimension: "audience_tag",
    value: GIRLS_HUB_AUDIENCE_TAG,
  });
  assert.equal(GIRLS_HUB_HERO_ARIA_LABEL, "Примеры фото девушки");
});

test("girls hub hero pins audience and ignores query-filter slices", () => {
  const params = girlsHubHeroFetchParams({
    audience_tag: "devushka",
    style_tag: "cherno_beloe",
    occasion_tag: "den_rozhdeniya",
    object_tag: "s_cvetami",
    doc_task_tag: null,
  });
  assert.equal(params.audience_tag, GIRLS_HUB_AUDIENCE_TAG);
  assert.equal(params.style_tag, null);
  assert.equal(params.occasion_tag, null);
  assert.equal(params.object_tag, null);
  assert.equal(params.sort, "new");
  assert.equal(params.limit, GIRLS_HUB_HERO_CARD_LIMIT);
  assert.equal(
    toGirlsHubHeroCarouselCards([
      { photoUrl: null },
      { photoUrl: "/a.jpg" },
      { photoUrl: "/b.jpg" },
    ]).length,
    2,
  );
});
