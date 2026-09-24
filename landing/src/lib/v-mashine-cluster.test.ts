import assert from "node:assert/strict";
import test from "node:test";
import {
  V_MASHINE_HUB_FILTER_CHIPS,
  V_MASHINE_HUB_PATH,
  V_MASHINE_LEGACY_PATH,
  getVMashineHubFilterNavItems,
  isVMashineClusterPath,
  isVMashineHubPath,
  vMashineChildRedirectPath,
  vMashineHubFilterHref,
  vMashineHubHeroFetchParams,
  toVMashineHubHeroCarouselCards,
} from "./v-mashine-cluster";

test("in-car hub path is /promty-dlya-foto/v-mashine", () => {
  assert.equal(V_MASHINE_HUB_PATH, "/promty-dlya-foto/v-mashine");
  assert.equal(isVMashineHubPath(V_MASHINE_HUB_PATH), true);
  assert.equal(isVMashineHubPath(V_MASHINE_LEGACY_PATH), false);
  assert.equal(isVMashineClusterPath("/promty-dlya-foto-par/v-mashine"), false);
  assert.equal(vMashineChildRedirectPath(V_MASHINE_LEGACY_PATH), V_MASHINE_HUB_PATH);
  assert.equal(vMashineChildRedirectPath(`${V_MASHINE_LEGACY_PATH}/portret`), V_MASHINE_HUB_PATH);
  assert.equal(vMashineChildRedirectPath(V_MASHINE_HUB_PATH), null);
});

test("in-car hero stays on object_tag=v_mashine and ignores query filters", () => {
  const params = vMashineHubHeroFetchParams({
    audience_tag: "devushka",
    style_tag: "portret",
    occasion_tag: null,
    object_tag: "osen",
    doc_task_tag: null,
  });
  assert.equal(params.object_tag, "v_mashine");
  assert.equal(params.audience_tag, null);
  assert.equal(params.style_tag, null);
  assert.equal(params.sort, "new");
});

test("in-car chips stay on the hub and do not replace the object tag", () => {
  assert.ok(V_MASHINE_HUB_FILTER_CHIPS.every((chip) => chip.queryKey !== "object"));
  assert.equal(
    vMashineHubFilterHref(V_MASHINE_HUB_FILTER_CHIPS[0]),
    `${V_MASHINE_HUB_PATH}?audience=devushka`,
  );
  const items = getVMashineHubFilterNavItems({ style: "portret" });
  assert.equal(items.find((item) => item.label === "Портрет")?.active, true);
});

test("in-car hero carousel drops cards without a photo", () => {
  const cards = toVMashineHubHeroCarouselCards([
    { photoUrl: null, id: "a" },
    { photoUrl: "https://cdn.example/car.jpg", id: "b" },
  ]);
  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.id, "b");
});
