import assert from "node:assert/strict";
import test from "node:test";
import {
  isListingCatalogHubClusterPath,
  listingCatalogHubChildRedirectPath,
  listingCatalogHubGenerateCta,
  resolveListingCatalogHub,
  resolveListingCatalogHubL1,
} from "./listing-catalog-hub";
import { PROMTY_DLYA_FOTO_PAR_HUB_PATH } from "./promty-dlya-foto-par-cluster";
import { PROMTY_DLYA_FOTO_DEVUSHKI_HUB_PATH } from "./promty-dlya-foto-devushki-cluster";

test("dispatcher resolves exact hub paths only", () => {
  assert.equal(
    resolveListingCatalogHub("/promty-dlya-foto-par")?.path,
    PROMTY_DLYA_FOTO_PAR_HUB_PATH,
  );
  assert.equal(
    resolveListingCatalogHub("/promty-dlya-foto-devushki/")?.path,
    PROMTY_DLYA_FOTO_DEVUSHKI_HUB_PATH,
  );
  assert.equal(resolveListingCatalogHub("/promty-dlya-foto-par/portret"), null);
  assert.equal(
    resolveListingCatalogHub("/promty-dlya-foto-devushki/s-cvetami"),
    null,
  );
  assert.equal(resolveListingCatalogHubL1("/promty-dlya-foto-devushki", 2), null);
  assert.ok(resolveListingCatalogHubL1("/promty-dlya-foto-devushki", 1));
});

test("one redirect predicate covers both catalog hubs", () => {
  assert.equal(
    listingCatalogHubChildRedirectPath("/promty-dlya-foto-par/osen"),
    PROMTY_DLYA_FOTO_PAR_HUB_PATH,
  );
  assert.equal(
    listingCatalogHubChildRedirectPath("/promty-dlya-foto-devushki/portret"),
    PROMTY_DLYA_FOTO_DEVUSHKI_HUB_PATH,
  );
  assert.equal(
    listingCatalogHubChildRedirectPath("/promty-dlya-foto-devushki/den-rozhdeniya"),
    null,
  );
  assert.equal(isListingCatalogHubClusterPath("/promty-dlya-foto-par"), true);
  assert.equal(
    isListingCatalogHubClusterPath("/promty-dlya-foto-devushki/s-cvetami"),
    true,
  );
  assert.equal(isListingCatalogHubClusterPath("/promty-dlya-foto-muzhchiny"), false);
});

test("idle CTA comes from the hub SSOT", () => {
  assert.equal(
    listingCatalogHubGenerateCta("/promty-dlya-foto-par"),
    "Создать фото пары",
  );
  assert.equal(
    listingCatalogHubGenerateCta("/promty-dlya-foto-devushki/"),
    "Создать фото девушки",
  );
  assert.equal(listingCatalogHubGenerateCta("/"), null);
});
