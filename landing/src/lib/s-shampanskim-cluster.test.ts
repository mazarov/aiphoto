import assert from "node:assert/strict";
import test from "node:test";
import {
  S_SHAMPANSKIM_HUB_FILTER_CHIPS,
  S_SHAMPANSKIM_HUB_PATH,
  S_SHAMPANSKIM_LEGACY_PATH,
  getSShampanskimHubFilterNavItems,
  isSShampanskimClusterPath,
  isSShampanskimHubPath,
  sShampanskimChildRedirectPath,
  sShampanskimHubFilterHref,
  sShampanskimHubHeroFetchParams,
  toSShampanskimHubHeroCarouselCards,
} from "./s-shampanskim-cluster";

test("champagne hub path is /promty-dlya-foto/s-shampanskim", () => {
  assert.equal(S_SHAMPANSKIM_HUB_PATH, "/promty-dlya-foto/s-shampanskim");
  assert.equal(isSShampanskimHubPath(S_SHAMPANSKIM_HUB_PATH), true);
  assert.equal(isSShampanskimHubPath(S_SHAMPANSKIM_LEGACY_PATH), false);
  assert.equal(sShampanskimChildRedirectPath(S_SHAMPANSKIM_LEGACY_PATH), S_SHAMPANSKIM_HUB_PATH);
  assert.equal(sShampanskimChildRedirectPath(S_SHAMPANSKIM_HUB_PATH), null);
  assert.equal(isSShampanskimClusterPath("/promty-dlya-foto-par/s-shampanskim"), false);
});

test("champagne hero stays on object_tag=s_shampanskim and ignores query filters", () => {
  const params = sShampanskimHubHeroFetchParams({
    audience_tag: "devushka",
    style_tag: "portret",
    occasion_tag: "den-rozhdeniya",
    object_tag: "osen",
    doc_task_tag: null,
  });
  assert.equal(params.object_tag, "s_shampanskim");
  assert.equal(params.audience_tag, null);
  assert.equal(params.sort, "new");
});

test("champagne chips stay on the hub and do not replace the object tag", () => {
  assert.ok(S_SHAMPANSKIM_HUB_FILTER_CHIPS.every((chip) => chip.queryKey !== "object"));
  assert.equal(
    sShampanskimHubFilterHref(S_SHAMPANSKIM_HUB_FILTER_CHIPS[0]),
    `${S_SHAMPANSKIM_HUB_PATH}?audience=devushka`,
  );
  const items = getSShampanskimHubFilterNavItems({ style: "portret" });
  assert.equal(items.find((item) => item.label === "Портрет")?.active, true);
});

test("champagne hero carousel drops cards without a photo", () => {
  const cards = toSShampanskimHubHeroCarouselCards([
    { photoUrl: null, id: "a" },
    { photoUrl: "https://cdn.example/glass.jpg", id: "b" },
  ]);
  assert.equal(cards.length, 1);
});
