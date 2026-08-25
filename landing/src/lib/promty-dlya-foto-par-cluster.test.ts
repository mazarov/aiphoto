import assert from "node:assert/strict";
import test from "node:test";
import {
  GENERACIYA_FOTO_PARY_PATH,
  PROMTY_DLYA_FOTO_PAR_HUB_PATH,
  getFeaturedPairsNavItems,
  isFeaturedPairsChildAlias,
  isGeneraciyaFotoParyPath,
  isPairsPromptAdLandingPath,
  isPromtyDlyaFotoParClusterPath,
  isPromtyDlyaFotoParHubPath,
  pairsActiveAliasFromPath,
  pairsChildPath,
} from "./promty-dlya-foto-par-cluster";

test("hub path stays under /promty-dlya-foto-par", () => {
  assert.equal(PROMTY_DLYA_FOTO_PAR_HUB_PATH, "/promty-dlya-foto-par");
  assert.equal(isPromtyDlyaFotoParHubPath("/promty-dlya-foto-par"), true);
  assert.equal(isPromtyDlyaFotoParHubPath("/promty-dlya-foto-par/"), true);
  assert.equal(
    isPromtyDlyaFotoParClusterPath("/promty-dlya-foto-par/cherno-beloe"),
    true,
  );
  assert.equal(isPromtyDlyaFotoParHubPath("/promty-dlya-foto-s-parnem"), false);
  assert.equal(
    isPromtyDlyaFotoParClusterPath("/promty-dlya-foto-s-parnem"),
    false,
  );
});

test("ad landing paths include sitelink hubs and generate pary", () => {
  assert.equal(isPairsPromptAdLandingPath("/promty-dlya-foto-par"), true);
  assert.equal(
    isPairsPromptAdLandingPath("/promty-dlya-foto-par/portret"),
    true,
  );
  assert.equal(isPairsPromptAdLandingPath("/promty-dlya-foto-s-parnem"), true);
  assert.equal(isPairsPromptAdLandingPath("/promty-dlya-foto-s-muzhem"), true);
  assert.equal(
    isPairsPromptAdLandingPath("/promty-dlya-foto-vlyublennykh"),
    true,
  );
  assert.equal(isPairsPromptAdLandingPath("/promty-dlya-foto-devushki"), false);
  assert.equal(isGeneraciyaFotoParyPath(GENERACIYA_FOTO_PARY_PATH), true);
  assert.equal(isGeneraciyaFotoParyPath("/generaciya-foto/pary/"), true);
  assert.equal(isGeneraciyaFotoParyPath("/generaciya-foto/semya"), false);
});

test("featured nav starts with Все and marks the active child", () => {
  const hubItems = getFeaturedPairsNavItems();
  assert.deepEqual(hubItems[0], {
    label: "Все",
    href: PROMTY_DLYA_FOTO_PAR_HUB_PATH,
    active: true,
  });
  assert.ok(
    hubItems.some((item) => item.href === pairsChildPath("cherno-beloe")),
  );
  assert.equal(
    hubItems.some((item) => item.href.includes("svadba")),
    false,
  );
  assert.equal(
    hubItems.some((item) => item.href.includes("14-fevralya")),
    false,
  );

  const childItems = getFeaturedPairsNavItems("cherno-beloe");
  assert.equal(childItems[0].active, false);
  assert.equal(
    childItems.find((item) => item.href === pairsChildPath("cherno-beloe"))
      ?.active,
    true,
  );
});

test("active alias and featured set come from the path", () => {
  assert.equal(pairsActiveAliasFromPath("/promty-dlya-foto-par"), null);
  assert.equal(
    pairsActiveAliasFromPath("/promty-dlya-foto-par/cherno-beloe"),
    "cherno-beloe",
  );
  assert.equal(isFeaturedPairsChildAlias("portret"), true);
  assert.equal(isFeaturedPairsChildAlias("svadba"), false);
});
