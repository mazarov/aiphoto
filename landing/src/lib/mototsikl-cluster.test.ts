import assert from "node:assert/strict";
import test from "node:test";
import {
  MOTOTSIKL_HUB_FILTER_CHIPS,
  MOTOTSIKL_HUB_PATH,
  MOTOTSIKL_LEGACY_PATH,
  getMototsiklHubFilterNavItems,
  isMototsiklClusterPath,
  isMototsiklHubPath,
  mototsiklChildRedirectPath,
  mototsiklHubFilterHref,
  mototsiklHubHeroFetchParams,
  toMototsiklHubHeroCarouselCards,
} from "./mototsikl-cluster";

test("motorcycle hub path is /promty-dlya-foto/mototsikl", () => {
  assert.equal(MOTOTSIKL_HUB_PATH, "/promty-dlya-foto/mototsikl");
  assert.equal(isMototsiklHubPath(MOTOTSIKL_HUB_PATH), true);
  assert.equal(mototsiklChildRedirectPath(MOTOTSIKL_LEGACY_PATH), MOTOTSIKL_HUB_PATH);
  assert.equal(mototsiklChildRedirectPath(MOTOTSIKL_HUB_PATH), null);
  assert.equal(isMototsiklClusterPath("/promty-dlya-foto-par/mototsikl"), false);
});

test("motorcycle hero stays on object_tag=mototsikl and ignores query filters", () => {
  const params = mototsiklHubHeroFetchParams({
    audience_tag: "devushka",
    style_tag: "portret",
    occasion_tag: null,
    object_tag: "osen",
    doc_task_tag: null,
  });
  assert.equal(params.object_tag, "mototsikl");
  assert.equal(params.audience_tag, null);
  assert.equal(params.sort, "new");
});

test("motorcycle chips stay on the hub and do not replace the object tag", () => {
  assert.ok(MOTOTSIKL_HUB_FILTER_CHIPS.every((chip) => chip.queryKey !== "object"));
  assert.equal(
    mototsiklHubFilterHref(MOTOTSIKL_HUB_FILTER_CHIPS[0]),
    `${MOTOTSIKL_HUB_PATH}?audience=devushka`,
  );
  const items = getMototsiklHubFilterNavItems({ style: "portret" });
  assert.equal(items.find((item) => item.label === "Портрет")?.active, true);
});

test("motorcycle hero carousel drops cards without a photo", () => {
  const cards = toMototsiklHubHeroCarouselCards([
    { photoUrl: null, id: "a" },
    { photoUrl: "https://cdn.example/moto.jpg", id: "b" },
  ]);
  assert.equal(cards.length, 1);
});
