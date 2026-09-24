import assert from "node:assert/strict";
import test from "node:test";
import {
  NA_MORE_HUB_FILTER_CHIPS,
  NA_MORE_HUB_PATH,
  NA_MORE_LEGACY_PATH,
  getNaMoreHubFilterNavItems,
  isNaMoreClusterPath,
  isNaMoreHubPath,
  naMoreChildRedirectPath,
  naMoreHubFilterHref,
  naMoreHubHeroFetchParams,
  toNaMoreHubHeroCarouselCards,
} from "./na-more-cluster";

test("sea hub path is /promty-dlya-foto/na-more", () => {
  assert.equal(NA_MORE_HUB_PATH, "/promty-dlya-foto/na-more");
  assert.equal(isNaMoreHubPath(NA_MORE_HUB_PATH), true);
  assert.equal(isNaMoreHubPath(NA_MORE_LEGACY_PATH), false);
  assert.equal(isNaMoreClusterPath(NA_MORE_LEGACY_PATH), true);
  assert.equal(naMoreChildRedirectPath(NA_MORE_LEGACY_PATH), NA_MORE_HUB_PATH);
  assert.equal(naMoreChildRedirectPath(`${NA_MORE_LEGACY_PATH}/portret`), NA_MORE_HUB_PATH);
  assert.equal(naMoreChildRedirectPath(`${NA_MORE_HUB_PATH}/portret`), NA_MORE_HUB_PATH);
  assert.equal(naMoreChildRedirectPath(NA_MORE_HUB_PATH), null);
});

test("sea hero stays on object_tag=na_more and ignores query filters", () => {
  const params = naMoreHubHeroFetchParams({
    audience_tag: "devushka",
    style_tag: "portret",
    occasion_tag: null,
    object_tag: "osen",
    doc_task_tag: null,
  });
  assert.equal(params.object_tag, "na_more");
  assert.equal(params.audience_tag, null);
  assert.equal(params.style_tag, null);
  assert.equal(params.sort, "new");
});

test("sea chips stay on the hub and do not replace the object tag", () => {
  assert.ok(NA_MORE_HUB_FILTER_CHIPS.every((chip) => chip.queryKey !== "object"));
  assert.equal(
    naMoreHubFilterHref(NA_MORE_HUB_FILTER_CHIPS[0]),
    `${NA_MORE_HUB_PATH}?audience=devushka`,
  );
  const items = getNaMoreHubFilterNavItems({ style: "portret" });
  assert.equal(items.find((item) => item.label === "Портрет")?.active, true);
  assert.equal(items.find((item) => item.label === "Девушка")?.active, false);
});

test("sea hero carousel drops cards without a photo", () => {
  const cards = toNaMoreHubHeroCarouselCards([
    { photoUrl: null, id: "a" },
    { photoUrl: "https://cdn.example/sea.jpg", id: "b" },
  ]);
  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.id, "b");
});
