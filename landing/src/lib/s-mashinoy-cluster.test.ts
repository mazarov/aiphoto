import assert from "node:assert/strict";
import test from "node:test";
import {
  S_MASHINOY_HUB_FILTER_CHIPS,
  S_MASHINOY_HUB_PATH,
  S_MASHINOY_LEGACY_PATH,
  getSMashinoyHubFilterNavItems,
  isSMashinoyClusterPath,
  isSMashinoyHubPath,
  sMashinoyChildRedirectPath,
  sMashinoyHubFilterHref,
  sMashinoyHubHeroFetchParams,
  toSMashinoyHubHeroCarouselCards,
} from "./s-mashinoy-cluster";

test("car hub path is /promty-dlya-foto/s-mashinoy", () => {
  assert.equal(S_MASHINOY_HUB_PATH, "/promty-dlya-foto/s-mashinoy");
  assert.equal(isSMashinoyHubPath("/promty-dlya-foto/s-mashinoy"), true);
  assert.equal(isSMashinoyHubPath("/promty-dlya-foto/s-mashinoy/"), true);
  assert.equal(isSMashinoyHubPath(S_MASHINOY_LEGACY_PATH), false);
  assert.equal(isSMashinoyClusterPath("/s-mashinoy"), true);
  assert.equal(isSMashinoyClusterPath("/promty-dlya-foto/s-mashinoy/portret"), true);
  assert.equal(sMashinoyChildRedirectPath("/s-mashinoy"), S_MASHINOY_HUB_PATH);
  assert.equal(sMashinoyChildRedirectPath("/s-mashinoy/portret"), S_MASHINOY_HUB_PATH);
  assert.equal(
    sMashinoyChildRedirectPath("/promty-dlya-foto/s-mashinoy/portret"),
    S_MASHINOY_HUB_PATH,
  );
  assert.equal(sMashinoyChildRedirectPath(S_MASHINOY_HUB_PATH), null);
});

test("car hero stays on object_tag=s_mashinoy and ignores query filters", () => {
  const params = sMashinoyHubHeroFetchParams({
    audience_tag: "devushka",
    style_tag: "portret",
    occasion_tag: "23_fevralya",
    object_tag: "osen",
    doc_task_tag: null,
  });
  assert.equal(params.object_tag, "s_mashinoy");
  assert.equal(params.audience_tag, null);
  assert.equal(params.style_tag, null);
  assert.equal(params.occasion_tag, null);
  assert.equal(params.sort, "new");
});

test("car chips stay on the hub and do not replace the object tag", () => {
  assert.ok(S_MASHINOY_HUB_FILTER_CHIPS.every((chip) => chip.queryKey !== "object"));
  assert.equal(
    sMashinoyHubFilterHref(S_MASHINOY_HUB_FILTER_CHIPS[0]),
    "/promty-dlya-foto/s-mashinoy?audience=devushka",
  );
  const items = getSMashinoyHubFilterNavItems({ style: "portret" });
  assert.equal(items[0]?.href, S_MASHINOY_HUB_PATH);
  assert.equal(items.find((item) => item.label === "Портрет")?.active, true);
  assert.equal(items.find((item) => item.label === "Мужчина")?.active, false);
});

test("car hero carousel drops cards without a photo", () => {
  const cards = toSMashinoyHubHeroCarouselCards([
    { photoUrl: null, id: "a" },
    { photoUrl: "https://cdn.example/car.jpg", id: "b" },
  ]);
  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.id, "b");
});
