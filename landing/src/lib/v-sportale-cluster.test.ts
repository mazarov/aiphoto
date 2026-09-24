import assert from "node:assert/strict";
import test from "node:test";
import {
  V_SPORTALE_HUB_FILTER_CHIPS,
  V_SPORTALE_HUB_PATH,
  V_SPORTALE_LEGACY_PATH,
  getVSportaleHubFilterNavItems,
  isVSportaleClusterPath,
  isVSportaleHubPath,
  vSportaleChildRedirectPath,
  vSportaleHubFilterHref,
  vSportaleHubHeroFetchParams,
  toVSportaleHubHeroCarouselCards,
} from "./v-sportale-cluster";

test("gym hub path is /promty-dlya-foto/v-sportale", () => {
  assert.equal(V_SPORTALE_HUB_PATH, "/promty-dlya-foto/v-sportale");
  assert.equal(isVSportaleHubPath(V_SPORTALE_HUB_PATH), true);
  assert.equal(vSportaleChildRedirectPath(V_SPORTALE_LEGACY_PATH), V_SPORTALE_HUB_PATH);
  assert.equal(vSportaleChildRedirectPath(V_SPORTALE_HUB_PATH), null);
  assert.equal(isVSportaleClusterPath("/promty-dlya-foto-par/v-sportale"), false);
});

test("gym hero stays on object_tag=v_sportale and ignores query filters", () => {
  const params = vSportaleHubHeroFetchParams({
    audience_tag: "devushka",
    style_tag: "portret",
    occasion_tag: null,
    object_tag: "osen",
    doc_task_tag: null,
  });
  assert.equal(params.object_tag, "v_sportale");
  assert.equal(params.audience_tag, null);
  assert.equal(params.sort, "new");
});

test("gym chips stay on the hub and do not replace the object tag", () => {
  assert.ok(V_SPORTALE_HUB_FILTER_CHIPS.every((chip) => chip.queryKey !== "object"));
  assert.equal(
    vSportaleHubFilterHref(V_SPORTALE_HUB_FILTER_CHIPS[1]),
    `${V_SPORTALE_HUB_PATH}?audience=muzhchina`,
  );
  const items = getVSportaleHubFilterNavItems({ audience: "muzhchina" });
  assert.equal(items.find((item) => item.label === "Мужчина")?.active, true);
});

test("gym hero carousel drops cards without a photo", () => {
  const cards = toVSportaleHubHeroCarouselCards([
    { photoUrl: null, id: "a" },
    { photoUrl: "https://cdn.example/gym.jpg", id: "b" },
  ]);
  assert.equal(cards.length, 1);
});
