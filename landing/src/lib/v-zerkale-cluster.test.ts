import assert from "node:assert/strict";
import test from "node:test";
import {
  V_ZERKALE_HUB_FILTER_CHIPS,
  V_ZERKALE_HUB_PATH,
  V_ZERKALE_LEGACY_PATH,
  getVZerkaleHubFilterNavItems,
  isVZerkaleClusterPath,
  isVZerkaleHubPath,
  vZerkaleChildRedirectPath,
  vZerkaleHubFilterHref,
  vZerkaleHubHeroFetchParams,
  toVZerkaleHubHeroCarouselCards,
} from "./v-zerkale-cluster";

test("mirror hub path is /promty-dlya-foto/v-zerkale", () => {
  assert.equal(V_ZERKALE_HUB_PATH, "/promty-dlya-foto/v-zerkale");
  assert.equal(isVZerkaleHubPath(V_ZERKALE_HUB_PATH), true);
  assert.equal(vZerkaleChildRedirectPath(V_ZERKALE_LEGACY_PATH), V_ZERKALE_HUB_PATH);
  assert.equal(vZerkaleChildRedirectPath(V_ZERKALE_HUB_PATH), null);
  assert.equal(isVZerkaleClusterPath("/promty-dlya-foto-par/v-zerkale"), false);
});

test("mirror hero stays on object_tag=v_zerkale and ignores query filters", () => {
  const params = vZerkaleHubHeroFetchParams({
    audience_tag: "para",
    style_tag: "portret",
    occasion_tag: null,
    object_tag: "osen",
    doc_task_tag: null,
  });
  assert.equal(params.object_tag, "v_zerkale");
  assert.equal(params.audience_tag, null);
  assert.equal(params.sort, "new");
});

test("mirror chips stay on the hub and do not replace the object tag", () => {
  assert.ok(V_ZERKALE_HUB_FILTER_CHIPS.every((chip) => chip.queryKey !== "object"));
  assert.equal(
    vZerkaleHubFilterHref(V_ZERKALE_HUB_FILTER_CHIPS[1]),
    `${V_ZERKALE_HUB_PATH}?audience=para`,
  );
  const items = getVZerkaleHubFilterNavItems({ audience: "para" });
  assert.equal(items.find((item) => item.label === "Пара")?.active, true);
});

test("mirror hero carousel drops cards without a photo", () => {
  const cards = toVZerkaleHubHeroCarouselCards([
    { photoUrl: null, id: "a" },
    { photoUrl: "https://cdn.example/mirror.jpg", id: "b" },
  ]);
  assert.equal(cards.length, 1);
});
