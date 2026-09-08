import assert from "node:assert/strict";
import test from "node:test";
import {
  GENERACIYA_FOTO_MUZHCHINY_PATH,
  MEN_HUB_AUDIENCE_TAG,
  MEN_HUB_COMPOSE_EXAMPLE_FILTER,
  MEN_HUB_FILTER_CHIPS,
  MEN_HUB_GENERATE_CTA,
  MEN_HUB_HERO_ARIA_LABEL,
  MEN_HUB_HERO_CARD_LIMIT,
  MEN_HUB_LOAD_MORE_LABEL,
  PROMTY_DLYA_FOTO_MUZHCHINY_HUB_PATH,
  getMenHubFilterNavItems,
  isGeneraciyaFotoMuzhchinyPath,
  isMenHubBirthdayOwnedPath,
  isPromtyDlyaFotoMuzhchinyClusterPath,
  isPromtyDlyaFotoMuzhchinyHubPath,
  menChildRedirectPath,
  menHubFilterHref,
  menHubHeroFetchParams,
  toMenHubHeroCarouselCards,
} from "./promty-dlya-foto-muzhchiny-cluster";

test("hub path stays under /promty-dlya-foto-muzhchiny", () => {
  assert.equal(PROMTY_DLYA_FOTO_MUZHCHINY_HUB_PATH, "/promty-dlya-foto-muzhchiny");
  assert.equal(isPromtyDlyaFotoMuzhchinyHubPath("/promty-dlya-foto-muzhchiny"), true);
  assert.equal(isPromtyDlyaFotoMuzhchinyHubPath("/promty-dlya-foto-muzhchiny/"), true);
  assert.equal(
    isPromtyDlyaFotoMuzhchinyClusterPath("/promty-dlya-foto-muzhchiny/s-mashinoy"),
    true,
  );
  assert.equal(isPromtyDlyaFotoMuzhchinyHubPath("/promty-dlya-foto-par"), false);
  assert.equal(isGeneraciyaFotoMuzhchinyPath(GENERACIYA_FOTO_MUZHCHINY_PATH), true);
  assert.equal(isGeneraciyaFotoMuzhchinyPath("/generaciya-foto/muzhchiny/"), true);
  assert.equal(isGeneraciyaFotoMuzhchinyPath("/generaciya-foto/devushki"), false);
});

test("plot L2 consolidates into the hub; birthday tails stay out", () => {
  assert.equal(menChildRedirectPath("/promty-dlya-foto-muzhchiny"), null);
  assert.equal(menChildRedirectPath("/promty-dlya-foto-muzhchiny/"), null);
  assert.equal(
    menChildRedirectPath("/promty-dlya-foto-muzhchiny/s-mashinoy"),
    PROMTY_DLYA_FOTO_MUZHCHINY_HUB_PATH,
  );
  assert.equal(
    menChildRedirectPath("/promty-dlya-foto-muzhchiny/portret/"),
    PROMTY_DLYA_FOTO_MUZHCHINY_HUB_PATH,
  );
  assert.equal(
    menChildRedirectPath("/promty-dlya-foto-muzhchiny/den-rozhdeniya"),
    null,
  );
  assert.equal(
    menChildRedirectPath("/promty-dlya-foto-muzhchiny/den-rozhdeniya/s-tortom"),
    null,
  );
  assert.equal(
    menChildRedirectPath("/promty-dlya-foto-muzhchiny/s-mashinoy/den-rozhdeniya"),
    null,
  );
  assert.equal(
    isMenHubBirthdayOwnedPath("/promty-dlya-foto-muzhchiny/den-rozhdeniya"),
    true,
  );
});

test("hub filters stay on the hub as query params", () => {
  assert.equal(menHubFilterHref(null), PROMTY_DLYA_FOTO_MUZHCHINY_HUB_PATH);
  for (const chip of MEN_HUB_FILTER_CHIPS) {
    const href = menHubFilterHref(chip);
    assert.equal(href.startsWith(`${PROMTY_DLYA_FOTO_MUZHCHINY_HUB_PATH}?`), true);
    assert.equal(href.includes(`/${chip.value}`), false);
    assert.equal(menChildRedirectPath(href.split("?")[0] ?? href), null);
  }

  const items = getMenHubFilterNavItems({ object: "s_mashinoy" });
  assert.equal(items[0]?.label, "Все");
  assert.equal(items[0]?.active, false);
  assert.equal(
    items.find((item) => item.label === "С машиной")?.active,
    true,
  );
  assert.equal(
    items.find((item) => item.label === "С машиной")?.href,
    `${PROMTY_DLYA_FOTO_MUZHCHINY_HUB_PATH}?object=s_mashinoy`,
  );
  assert.equal(MEN_HUB_LOAD_MORE_LABEL, "Больше промтов для мужчины");
  assert.equal(MEN_HUB_GENERATE_CTA, "Создать фото мужчины");
  assert.deepEqual(MEN_HUB_COMPOSE_EXAMPLE_FILTER, {
    label: "Мужчины",
    dimension: "audience_tag",
    value: MEN_HUB_AUDIENCE_TAG,
  });
  assert.equal(MEN_HUB_HERO_ARIA_LABEL, "Примеры фото мужчины");
});

test("men hub hero pins audience and ignores query-filter slices", () => {
  const params = menHubHeroFetchParams({
    audience_tag: "muzhchina",
    style_tag: "cherno_beloe",
    occasion_tag: "den_rozhdeniya",
    object_tag: "s_mashinoy",
    doc_task_tag: null,
  });
  assert.equal(params.audience_tag, MEN_HUB_AUDIENCE_TAG);
  assert.equal(params.style_tag, null);
  assert.equal(params.occasion_tag, null);
  assert.equal(params.object_tag, null);
  assert.equal(params.sort, "new");
  assert.equal(params.limit, MEN_HUB_HERO_CARD_LIMIT);
  assert.equal(
    toMenHubHeroCarouselCards([
      { photoUrl: null },
      { photoUrl: "/a.jpg" },
      { photoUrl: "/b.jpg" },
    ]).length,
    2,
  );
});
