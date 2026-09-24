import assert from "node:assert/strict";
import test from "node:test";
import {
  S_TORTOM_HUB_FILTER_CHIPS,
  S_TORTOM_HUB_PATH,
  S_TORTOM_LEGACY_PATH,
  getSTortomHubFilterNavItems,
  isSTortomClusterPath,
  isSTortomHubPath,
  sTortomChildRedirectPath,
  sTortomHubFilterHref,
  sTortomHubHeroFetchParams,
  toSTortomHubHeroCarouselCards,
} from "./s-tortom-cluster";

test("cake hub path is /promty-dlya-foto/s-tortom", () => {
  assert.equal(S_TORTOM_HUB_PATH, "/promty-dlya-foto/s-tortom");
  assert.equal(isSTortomHubPath(S_TORTOM_HUB_PATH), true);
  assert.equal(sTortomChildRedirectPath(S_TORTOM_LEGACY_PATH), S_TORTOM_HUB_PATH);
  assert.equal(sTortomChildRedirectPath(S_TORTOM_HUB_PATH), null);
  assert.equal(isSTortomClusterPath("/promty-dlya-foto-par/s-tortom"), false);
});

test("cake hero stays on object_tag=s_tortom and ignores query filters", () => {
  const params = sTortomHubHeroFetchParams({
    audience_tag: "devushka",
    style_tag: "portret",
    occasion_tag: "den-rozhdeniya",
    object_tag: "osen",
    doc_task_tag: null,
  });
  assert.equal(params.object_tag, "s_tortom");
  assert.equal(params.audience_tag, null);
  assert.equal(params.sort, "new");
});

test("cake chips stay on the hub and do not replace the object tag", () => {
  assert.ok(S_TORTOM_HUB_FILTER_CHIPS.every((chip) => chip.queryKey !== "object"));
  assert.equal(
    sTortomHubFilterHref(S_TORTOM_HUB_FILTER_CHIPS[0]),
    `${S_TORTOM_HUB_PATH}?audience=devushka`,
  );
  const items = getSTortomHubFilterNavItems({ audience: "muzhchina" });
  assert.equal(items.find((item) => item.label === "Мужчина")?.active, true);
});

test("cake hero carousel drops cards without a photo", () => {
  const cards = toSTortomHubHeroCarouselCards([
    { photoUrl: null, id: "a" },
    { photoUrl: "https://cdn.example/cake.jpg", id: "b" },
  ]);
  assert.equal(cards.length, 1);
});
