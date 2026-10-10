/** `npx tsx --conditions react-server --test src/lib/admin-photoshoot-albums.test.ts` — pinSeoTags loads server-only tag-patterns. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  adminPhotoshootScenarioOptions,
  parseAdminPhotoshootPublicationFilter,
  resolveAlbumPublicationStatus,
  scenarioSlugsForSeoTags,
  validateScenarioPins,
} from "./admin-photoshoot-albums";
import { pinSeoTags } from "./seo-tags-classify";

test("publication filter defaults to unpublished and rejects junk", () => {
  assert.equal(parseAdminPhotoshootPublicationFilter(null), "unpublished");
  assert.equal(parseAdminPhotoshootPublicationFilter("PUBLISHED"), "published");
  assert.equal(parseAdminPhotoshootPublicationFilter("all"), "all");
  assert.equal(parseAdminPhotoshootPublicationFilter("drafts"), null);
});

test("scenario pins map cluster children to registry tags and hub paths", () => {
  const result = validateScenarioPins(["zhenskie", "studiynye", "zhenskie"]);
  assert.ok(result.ok);
  assert.deepEqual(result.slugs, ["zhenskie", "studiynye"]);
  assert.deepEqual(result.pins, [
    { dimension: "audience_tag", slug: "devushka" },
    { dimension: "style_tag", slug: "studiynoe" },
  ]);
  assert.deepEqual(result.revalidatePaths, [
    "/ii-fotosessiya",
    "/ii-fotosessiya/zhenskie",
    "/ii-fotosessiya/studiynye",
  ]);
  const empty = validateScenarioPins(undefined);
  assert.ok(empty.ok);
  assert.deepEqual(empty.pins, []);
  assert.deepEqual(empty.revalidatePaths, ["/ii-fotosessiya"]);
});

test("one exclusive audience per album; unknown slugs rejected", () => {
  assert.deepEqual(validateScenarioPins(["zhenskie", "pary"]), {
    ok: false,
    error: "multiple_exclusive_scenarios",
  });
  assert.deepEqual(validateScenarioPins(["zhenskie", "detskie"]).ok, true);
  assert.deepEqual(validateScenarioPins(["devushki"]), {
    ok: false,
    error: "invalid_scenario",
  });
  const exclusive = adminPhotoshootScenarioOptions()
    .filter((option) => option.exclusive)
    .map((option) => option.slug);
  assert.deepEqual(exclusive, ["muzhskie", "zhenskie", "pary", "semeynye", "nyuborn"]);
});

test("card seo_tags resolve to the hub scenarios they already satisfy", () => {
  assert.deepEqual(
    scenarioSlugsForSeoTags({
      audience_tag: ["devushka", "vlyublennykh"],
      style_tag: ["cherno_beloe"],
      object_tag: ["zima"],
    }),
    ["zhenskie", "zimnyaya", "dlya-dvoih", "cherno-belye"],
  );
  assert.deepEqual(scenarioSlugsForSeoTags(null), []);
  assert.deepEqual(scenarioSlugsForSeoTags({ audience_tag: "devushka" }), []);
});

test("pinSeoTags adds registry slugs only and keeps existing tags", () => {
  const pinned = pinSeoTags(
    { audience_tag: ["para"], style_tag: ["portret"], labels: { ru: ["x"], en: ["y"] } },
    [
      { dimension: "style_tag", slug: "studiynoe" },
      { dimension: "style_tag", slug: "portret" },
      { dimension: "object_tag", slug: "no_such_tag" },
    ],
  );
  assert.equal(pinned.changed, true);
  assert.deepEqual(pinned.seo_tags.style_tag, ["portret", "studiynoe"]);
  assert.deepEqual(pinned.seo_tags.audience_tag, ["para"]);
  assert.deepEqual(pinned.seo_tags.object_tag, []);
  assert.equal(pinned.seo_readiness_score, 40);

  const unchanged = pinSeoTags({ style_tag: ["portret"] }, [{ dimension: "style_tag", slug: "portret" }]);
  assert.equal(unchanged.changed, false);
});

test("album publication status follows card presence", () => {
  assert.equal(resolveAlbumPublicationStatus({ ugc_card_id: null, card_exists: false, is_published: false }), "card_pending");
  assert.equal(resolveAlbumPublicationStatus({ ugc_card_id: "c", card_exists: false, is_published: false }), "card_missing");
  assert.equal(resolveAlbumPublicationStatus({ ugc_card_id: "c", card_exists: true, is_published: false }), "unpublished");
  assert.equal(resolveAlbumPublicationStatus({ ugc_card_id: "c", card_exists: true, is_published: true }), "published");
});
