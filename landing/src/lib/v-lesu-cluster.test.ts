import assert from "node:assert/strict";
import test from "node:test";
import {
  V_LESU_HUB_FILTER_CHIPS,
  V_LESU_HUB_PATH,
  V_LESU_LEGACY_PATH,
  getVLesuHubFilterNavItems,
  isVLesuClusterPath,
  isVLesuHubPath,
  vLesuChildRedirectPath,
  vLesuHubFilterHref,
  vLesuHubHeroFetchParams,
  toVLesuHubHeroCarouselCards,
} from "./v-lesu-cluster";

test("forest hub path is /promty-dlya-foto/v-lesu", () => {
  assert.equal(V_LESU_HUB_PATH, "/promty-dlya-foto/v-lesu");
  assert.equal(isVLesuHubPath(V_LESU_HUB_PATH), true);
  assert.equal(vLesuChildRedirectPath(V_LESU_LEGACY_PATH), V_LESU_HUB_PATH);
  assert.equal(vLesuChildRedirectPath(V_LESU_HUB_PATH), null);
  assert.equal(isVLesuClusterPath("/promty-dlya-foto-par/v-lesu"), false);
});

test("forest hero stays on object_tag=v_lesu and ignores query filters", () => {
  const params = vLesuHubHeroFetchParams({
    audience_tag: "devushka",
    style_tag: "portret",
    occasion_tag: null,
    object_tag: "osen",
    doc_task_tag: null,
  });
  assert.equal(params.object_tag, "v_lesu");
  assert.equal(params.audience_tag, null);
  assert.equal(params.sort, "new");
});

test("forest chips stay on the hub and do not replace the object tag", () => {
  assert.ok(V_LESU_HUB_FILTER_CHIPS.every((chip) => chip.queryKey !== "object"));
  assert.equal(
    vLesuHubFilterHref(V_LESU_HUB_FILTER_CHIPS[0]),
    `${V_LESU_HUB_PATH}?audience=devushka`,
  );
  const items = getVLesuHubFilterNavItems({ style: "portret" });
  assert.equal(items.find((item) => item.label === "Портрет")?.active, true);
});

test("forest hero carousel drops cards without a photo", () => {
  const cards = toVLesuHubHeroCarouselCards([
    { photoUrl: null, id: "a" },
    { photoUrl: "https://cdn.example/forest.jpg", id: "b" },
  ]);
  assert.equal(cards.length, 1);
});
