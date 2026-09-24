import assert from "node:assert/strict";
import test from "node:test";
import {
  OSEN_HUB_FILTER_CHIPS,
  OSEN_HUB_PATH,
  getOsenHubFilterNavItems,
  isOsenClusterPath,
  isOsenHubPath,
  osenChildRedirectPath,
  osenHubFilterHref,
  osenHubHeroFetchParams,
  toOsenHubHeroCarouselCards,
} from "./osen-cluster";

test("osen hub path is /osen", () => {
  assert.equal(OSEN_HUB_PATH, "/osen");
  assert.equal(isOsenHubPath("/osen"), true);
  assert.equal(isOsenHubPath("/osen/"), true);
  assert.equal(isOsenClusterPath("/osen/portret"), true);
  assert.equal(isOsenHubPath("/osen/portret"), false);
  assert.equal(osenChildRedirectPath("/osen/portret"), "/osen");
  assert.equal(osenChildRedirectPath("/osen"), null);
});

test("osen hero stays on object_tag=osen and ignores query filters", () => {
  const params = osenHubHeroFetchParams({
    audience_tag: "devushka",
    style_tag: "portret",
    occasion_tag: "den_rozhdeniya",
    object_tag: "v_lesu",
    doc_task_tag: null,
  });
  assert.equal(params.object_tag, "osen");
  assert.equal(params.audience_tag, null);
  assert.equal(params.style_tag, null);
  assert.equal(params.occasion_tag, null);
  assert.equal(params.sort, "new");
});

test("osen chips stay on the hub and do not replace the autumn object", () => {
  assert.ok(OSEN_HUB_FILTER_CHIPS.every((chip) => chip.queryKey !== "object"));
  assert.equal(osenHubFilterHref(OSEN_HUB_FILTER_CHIPS[0]), "/osen?audience=devushka");
  const items = getOsenHubFilterNavItems({ audience: "para" });
  assert.equal(items[0]?.href, "/osen");
  assert.equal(items.find((item) => item.label === "Пара")?.active, true);
  assert.equal(items.find((item) => item.label === "Девушка")?.active, false);
});

test("osen hero carousel drops cards without a photo", () => {
  const cards = toOsenHubHeroCarouselCards([
    { photoUrl: null, id: "a" },
    { photoUrl: "https://cdn.example/osen.jpg", id: "b" },
  ]);
  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.id, "b");
});
