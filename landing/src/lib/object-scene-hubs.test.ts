import assert from "node:assert/strict";
import test from "node:test";
import { getSeoForRoute } from "./seo-templates";
import { resolveUrlToTags } from "./route-resolver";
import {
  OBJECT_SCENE_HUB_SPECS,
  isObjectSceneClusterPath,
  objectSceneChildRedirectPath,
  objectSceneHeroFetchParams,
} from "./object-scene-hubs";
import {
  listingCatalogHubChildRedirectPath,
  listingCatalogHubGenerateCta,
  resolveListingCatalogHub,
} from "./listing-catalog-hub";

test("every remaining object scene hub resolves and 301s the old URL", () => {
  assert.equal(OBJECT_SCENE_HUB_SPECS.length, 83);
  for (const spec of OBJECT_SCENE_HUB_SPECS) {
    assert.equal(spec.hubPath, `/promty-dlya-foto${spec.legacyPath}`);
    assert.equal(resolveListingCatalogHub(spec.hubPath)?.path, spec.hubPath);
    assert.equal(resolveListingCatalogHub(spec.legacyPath), null);
    assert.equal(objectSceneChildRedirectPath(spec.legacyPath), spec.hubPath);
    assert.equal(objectSceneChildRedirectPath(spec.hubPath), null);
    assert.equal(listingCatalogHubChildRedirectPath(spec.legacyPath), spec.hubPath);
    assert.equal(isObjectSceneClusterPath(`/promty-dlya-foto-par${spec.legacyPath}`), false);
    assert.match(listingCatalogHubGenerateCta(spec.hubPath) ?? "", /^Создать фото /);

    const params = objectSceneHeroFetchParams(spec.slug)({
      audience_tag: "devushka",
      style_tag: "portret",
      occasion_tag: null,
      object_tag: "osen",
      doc_task_tag: null,
    });
    assert.equal(params.object_tag, spec.slug);
    assert.equal(params.audience_tag, null);
    assert.equal(params.sort, "new");

    const parts = spec.hubPath.split("/").filter(Boolean);
    const route = resolveUrlToTags(parts);
    assert.ok(route, spec.hubPath);
    assert.equal(route.canonicalPath, spec.hubPath);
    assert.equal(route.rpcParams.object_tag, spec.slug);
    assert.equal(resolveUrlToTags([spec.legacyPath.slice(1)]), null);

    const seo = getSeoForRoute(route);
    assert.ok(seo.h1.length > 0);
    assert.match(seo.metaTitle, /🇷🇺$/);
    assert.doesNotMatch(seo.h1, /🇷🇺/);
    assert.notEqual(seo.explorerTitle, seo.h1);
    assert.ok(seo.howToTitle);
    assert.equal(seo.popularLinks?.length ?? 0, 0);
    assert.equal(seo.faqItems.length >= 1, true);
  }
});
