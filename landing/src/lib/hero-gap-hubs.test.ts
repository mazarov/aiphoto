import assert from "node:assert/strict";
import test from "node:test";
import { getSeoContent } from "./seo-content";
import {
  HERO_GAP_HUB_SPECS,
  HERO_GAP_ONLY_REDIRECTS,
  heroGapChildRedirectPath,
  heroGapHeroFetchParams,
} from "./hero-gap-hubs";
import {
  listingCatalogHubChildRedirectPath,
  resolveListingCatalogHub,
} from "./listing-catalog-hub";

test("hero gap hubs keep the tag, move the URL, and 301 the old path", () => {
  assert.equal(HERO_GAP_HUB_SPECS.length, 71);
  assert.equal(
    listingCatalogHubChildRedirectPath("/promty-dlya-foto-s-parnem"),
    "/promty-dlya-foto-par",
  );
  assert.equal(listingCatalogHubChildRedirectPath("/stil/otkrytka/novyj-god"), null);
  for (const spec of HERO_GAP_HUB_SPECS) {
    assert.equal(resolveListingCatalogHub(spec.hubPath)?.path, spec.hubPath);
    assert.equal(resolveListingCatalogHub(spec.legacyPath), null);
    assert.equal(heroGapChildRedirectPath(spec.legacyPath), spec.hubPath);
    assert.equal(heroGapChildRedirectPath(spec.hubPath), null);
    assert.equal(listingCatalogHubChildRedirectPath(spec.legacyPath), spec.hubPath);
    const params = heroGapHeroFetchParams(spec.slug, spec.dimension)({
      audience_tag: "devushka",
      style_tag: "portret",
      occasion_tag: "svadba",
      object_tag: "s_mashinoy",
      doc_task_tag: "na_dokumenty",
    });
    assert.equal(params[spec.dimension], spec.slug);
    assert.equal(params.sort, "new");
    const seo = getSeoContent(spec.slug);
    assert.ok(seo);
    assert.match(seo.metaTitle, /🇷🇺$/);
    assert.equal(seo.h1.includes("🇷🇺"), false);
    if (seo.explorerTitle) {
      assert.notEqual(seo.explorerTitle.toLowerCase(), seo.h1.toLowerCase());
    }
  }
  for (const item of HERO_GAP_ONLY_REDIRECTS) {
    assert.equal(heroGapChildRedirectPath(item.legacyPath), item.hubPath);
    assert.equal(listingCatalogHubChildRedirectPath(item.legacyPath), item.hubPath);
    assert.equal(resolveListingCatalogHub(item.hubPath)?.path, item.hubPath);
  }
});
