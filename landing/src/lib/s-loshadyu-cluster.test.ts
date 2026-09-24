import assert from "node:assert/strict";
import test from "node:test";
import {
  S_LOSHADYU_HUB_FILTER_CHIPS,
  S_LOSHADYU_HUB_PATH,
  S_LOSHADYU_LEGACY_PATH,
  getSLoshadyuHubFilterNavItems,
  isSLoshadyuClusterPath,
  isSLoshadyuHubPath,
  sLoshadyuChildRedirectPath,
  sLoshadyuHubFilterHref,
  sLoshadyuHubHeroFetchParams,
  toSLoshadyuHubHeroCarouselCards,
} from "./s-loshadyu-cluster";

test("horse hub path is /promty-dlya-foto/s-loshadyu", () => {
  assert.equal(S_LOSHADYU_HUB_PATH, "/promty-dlya-foto/s-loshadyu");
  assert.equal(isSLoshadyuHubPath(S_LOSHADYU_HUB_PATH), true);
  assert.equal(sLoshadyuChildRedirectPath(S_LOSHADYU_LEGACY_PATH), S_LOSHADYU_HUB_PATH);
  assert.equal(sLoshadyuChildRedirectPath(S_LOSHADYU_HUB_PATH), null);
  assert.equal(isSLoshadyuClusterPath("/promty-dlya-foto-par/s-loshadyu"), false);
});

test("horse hero stays on object_tag=s_loshadyu and ignores query filters", () => {
  const params = sLoshadyuHubHeroFetchParams({
    audience_tag: "para",
    style_tag: "portret",
    occasion_tag: null,
    object_tag: "osen",
    doc_task_tag: null,
  });
  assert.equal(params.object_tag, "s_loshadyu");
  assert.equal(params.audience_tag, null);
  assert.equal(params.sort, "new");
});

test("horse chips stay on the hub and do not replace the object tag", () => {
  assert.ok(S_LOSHADYU_HUB_FILTER_CHIPS.every((chip) => chip.queryKey !== "object"));
  assert.equal(
    sLoshadyuHubFilterHref(S_LOSHADYU_HUB_FILTER_CHIPS[1]),
    `${S_LOSHADYU_HUB_PATH}?audience=para`,
  );
  const items = getSLoshadyuHubFilterNavItems({ audience: "para" });
  assert.equal(items.find((item) => item.label === "Пара")?.active, true);
});

test("horse hero carousel drops cards without a photo", () => {
  const cards = toSLoshadyuHubHeroCarouselCards([
    { photoUrl: null, id: "a" },
    { photoUrl: "https://cdn.example/horse.jpg", id: "b" },
  ]);
  assert.equal(cards.length, 1);
});
