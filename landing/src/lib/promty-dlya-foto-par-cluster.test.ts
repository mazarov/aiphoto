import assert from "node:assert/strict";
import test from "node:test";
import {
  GENERACIYA_FOTO_PARY_PATH,
  PAIRS_HUB_COMPOSE_EXAMPLE_FILTER,
  PAIRS_HUB_FILTER_CHIPS,
  PAIRS_HUB_GENERATE_CTA,
  PAIRS_HUB_HERO_ARIA_LABEL,
  PAIRS_HUB_HERO_CARD_LIMIT,
  PAIRS_HUB_LOAD_MORE_LABEL,
  PROMTY_DLYA_FOTO_PAR_HUB_PATH,
  pairsHubHeroFetchParams,
  toPairsHubHeroCarouselCards,
  getPairsHubFilterNavItems,
  isGeneraciyaFotoParyPath,
  isPairsPromptAdLandingPath,
  isPromtyDlyaFotoParClusterPath,
  isPromtyDlyaFotoParHubPath,
  pairsChildRedirectPath,
  pairsHubFilterHref,
} from "./promty-dlya-foto-par-cluster";

test("hub path stays under /promty-dlya-foto-par", () => {
  assert.equal(PROMTY_DLYA_FOTO_PAR_HUB_PATH, "/promty-dlya-foto-par");
  assert.equal(isPromtyDlyaFotoParHubPath("/promty-dlya-foto-par"), true);
  assert.equal(isPromtyDlyaFotoParHubPath("/promty-dlya-foto-par/"), true);
  assert.equal(
    isPromtyDlyaFotoParClusterPath("/promty-dlya-foto-par/cherno-beloe"),
    true,
  );
  assert.equal(isPromtyDlyaFotoParHubPath("/promty-dlya-foto-s-parnem"), false);
  assert.equal(
    isPromtyDlyaFotoParClusterPath("/promty-dlya-foto-s-parnem"),
    false,
  );
});

test("ad landing paths include sitelink hubs and generate pary", () => {
  assert.equal(isPairsPromptAdLandingPath("/promty-dlya-foto-par"), true);
  assert.equal(
    isPairsPromptAdLandingPath("/promty-dlya-foto-par/portret"),
    true,
  );
  assert.equal(isPairsPromptAdLandingPath("/promty-dlya-foto-s-parnem"), true);
  assert.equal(isPairsPromptAdLandingPath("/promty-dlya-foto-s-muzhem"), true);
  assert.equal(
    isPairsPromptAdLandingPath("/promty-dlya-foto-vlyublennykh"),
    true,
  );
  assert.equal(isPairsPromptAdLandingPath("/promty-dlya-foto-devushki"), false);
  assert.equal(isGeneraciyaFotoParyPath(GENERACIYA_FOTO_PARY_PATH), true);
  assert.equal(isGeneraciyaFotoParyPath("/generaciya-foto/pary/"), true);
  assert.equal(isGeneraciyaFotoParyPath("/generaciya-foto/semya"), false);
});

test("every pairs child consolidates into the hub", () => {
  assert.equal(pairsChildRedirectPath("/promty-dlya-foto-par"), null);
  assert.equal(pairsChildRedirectPath("/promty-dlya-foto-par/"), null);
  assert.equal(
    pairsChildRedirectPath("/promty-dlya-foto-par/cherno-beloe"),
    PROMTY_DLYA_FOTO_PAR_HUB_PATH,
  );
  assert.equal(
    pairsChildRedirectPath("/promty-dlya-foto-par/v-mashine/"),
    PROMTY_DLYA_FOTO_PAR_HUB_PATH,
  );
  assert.equal(
    pairsChildRedirectPath("/promty-dlya-foto-par/osen"),
    PROMTY_DLYA_FOTO_PAR_HUB_PATH,
  );
  assert.equal(
    pairsChildRedirectPath("/promty-dlya-foto-s-parnem"),
    PROMTY_DLYA_FOTO_PAR_HUB_PATH,
  );
  assert.equal(
    pairsChildRedirectPath("/promty-dlya-foto-s-parnem/"),
    PROMTY_DLYA_FOTO_PAR_HUB_PATH,
  );
  assert.equal(pairsChildRedirectPath("/promty-dlya-foto-s-muzhem"), null);
  assert.equal(pairsChildRedirectPath("/promty-dlya-foto-vlyublennykh"), null);
});

test("hub style filters stay on the hub as query params", () => {
  assert.equal(pairsHubFilterHref(null), PROMTY_DLYA_FOTO_PAR_HUB_PATH);
  for (const chip of PAIRS_HUB_FILTER_CHIPS) {
    const href = pairsHubFilterHref(chip);
    assert.equal(href.startsWith(`${PROMTY_DLYA_FOTO_PAR_HUB_PATH}?`), true);
    assert.equal(href.includes(`/${chip.value}`), false);
    assert.equal(pairsChildRedirectPath(href.split("?")[0] ?? href), null);
  }

  const items = getPairsHubFilterNavItems({ style: "cherno_beloe" });
  assert.equal(items[0]?.label, "Все");
  assert.equal(items[0]?.active, false);
  assert.equal(items[0]?.href, PROMTY_DLYA_FOTO_PAR_HUB_PATH);
  assert.equal(
    items.find((item) => item.label === "Чёрно-белое")?.active,
    true,
  );
  assert.equal(PAIRS_HUB_LOAD_MORE_LABEL, "Больше промтов для пар");
  assert.equal(PAIRS_HUB_GENERATE_CTA, "Создать фото пары");
  assert.deepEqual(PAIRS_HUB_COMPOSE_EXAMPLE_FILTER, {
    label: "Пары",
    dimension: "audience_tag",
    value: "para",
  });
  assert.equal(PAIRS_HUB_HERO_ARIA_LABEL, "Примеры парных фото");
});

test("pairs hub hero fetches newest pair cards, not query-filter slices", () => {
  const params = pairsHubHeroFetchParams({
    audience_tag: "para",
    style_tag: null,
    occasion_tag: null,
    object_tag: null,
    doc_task_tag: null,
  });
  assert.equal(params.audience_tag, "para");
  assert.equal(params.style_tag, null);
  assert.equal(params.occasion_tag, null);
  assert.equal(params.object_tag, null);
  assert.equal(params.sort, "new");
  assert.equal(params.limit, PAIRS_HUB_HERO_CARD_LIMIT);
  assert.equal(
    toPairsHubHeroCarouselCards([
      { photoUrl: null },
      { photoUrl: "/a.jpg" },
      { photoUrl: "/b.jpg" },
    ]).length,
    2,
  );
});

test("boyfriend and lovers chips filter the hub in-page", () => {
  const audienceChips = PAIRS_HUB_FILTER_CHIPS.filter(
    (chip) => chip.queryKey === "audience",
  );
  assert.deepEqual(
    audienceChips.map((chip) => chip.label),
    ["С парнем", "Влюблённые"],
  );

  const items = getPairsHubFilterNavItems({ audience: "s_parnem" });
  const boyfriend = items.find((item) => item.label === "С парнем");
  assert.equal(boyfriend?.active, true);
  assert.equal(boyfriend?.href, `${PROMTY_DLYA_FOTO_PAR_HUB_PATH}?audience=s_parnem`);
  assert.equal(items.find((item) => item.label === "Все")?.active, false);
  assert.equal(
    items.find((item) => item.label === "Влюблённые")?.href,
    `${PROMTY_DLYA_FOTO_PAR_HUB_PATH}?audience=vlyublennykh`,
  );
});
