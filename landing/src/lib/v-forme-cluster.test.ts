import assert from "node:assert/strict";
import test from "node:test";
import {
  V_FORME_HUB_FILTER_CHIPS,
  V_FORME_HUB_PATH,
  getVFormeHubFilterNavItems,
  isVFormeClusterPath,
  isVFormeHubPath,
  vFormeChildRedirectPath,
  vFormeHubFilterHref,
  vFormeHubHeroFetchParams,
  toVFormeHubHeroCarouselCards,
} from "./v-forme-cluster";

test("uniform hub path is /v-forme", () => {
  assert.equal(V_FORME_HUB_PATH, "/v-forme");
  assert.equal(isVFormeHubPath("/v-forme"), true);
  assert.equal(isVFormeHubPath("/v-forme/"), true);
  assert.equal(isVFormeClusterPath("/v-forme/portret"), true);
  assert.equal(isVFormeHubPath("/v-forme/portret"), false);
  assert.equal(vFormeChildRedirectPath("/v-forme/portret"), "/v-forme");
  assert.equal(vFormeChildRedirectPath("/v-forme"), null);
});

test("uniform hero stays on object_tag=v_forme and ignores query filters", () => {
  const params = vFormeHubHeroFetchParams({
    audience_tag: "devushka",
    style_tag: "portret",
    occasion_tag: "23_fevralya",
    object_tag: "osen",
    doc_task_tag: null,
  });
  assert.equal(params.object_tag, "v_forme");
  assert.equal(params.audience_tag, null);
  assert.equal(params.style_tag, null);
  assert.equal(params.occasion_tag, null);
  assert.equal(params.sort, "new");
});

test("uniform chips stay on the hub and do not replace the object tag", () => {
  assert.ok(V_FORME_HUB_FILTER_CHIPS.every((chip) => chip.queryKey !== "object"));
  assert.equal(
    vFormeHubFilterHref(V_FORME_HUB_FILTER_CHIPS[0]),
    "/v-forme?audience=s_muzhem",
  );
  const items = getVFormeHubFilterNavItems({ style: "portret" });
  assert.equal(items[0]?.href, "/v-forme");
  assert.equal(items.find((item) => item.label === "Портрет")?.active, true);
  assert.equal(items.find((item) => item.label === "Муж")?.active, false);
});

test("uniform hero carousel drops cards without a photo", () => {
  const cards = toVFormeHubHeroCarouselCards([
    { photoUrl: null, id: "a" },
    { photoUrl: "https://cdn.example/forme.jpg", id: "b" },
  ]);
  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.id, "b");
});
