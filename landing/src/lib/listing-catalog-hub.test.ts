import assert from "node:assert/strict";
import test from "node:test";
import {
  isListingCatalogHubClusterPath,
  isListingCatalogHubGenerateCta,
  listingCatalogHubChildRedirectPath,
  listingCatalogHubGenerateCta,
  resolveListingCatalogHub,
  resolveListingCatalogHubL1,
} from "./listing-catalog-hub";
import { PROMTY_DLYA_FOTO_PAR_HUB_PATH } from "./promty-dlya-foto-par-cluster";
import { PROMTY_DLYA_FOTO_DEVUSHKI_HUB_PATH } from "./promty-dlya-foto-devushki-cluster";
import { PROMTY_DLYA_FOTO_MUZHCHINY_HUB_PATH } from "./promty-dlya-foto-muzhchiny-cluster";
import { OSEN_HUB_PATH } from "./osen-cluster";
import { V_FORME_HUB_PATH } from "./v-forme-cluster";
import { S_MASHINOY_HUB_PATH } from "./s-mashinoy-cluster";
import { AVATAR_HUB_PATH } from "./foto-na-avatarku-cluster";
import { NA_MORE_HUB_PATH } from "./na-more-cluster";
import { V_MASHINE_HUB_PATH } from "./v-mashine-cluster";
import { S_SHAMPANSKIM_HUB_PATH } from "./s-shampanskim-cluster";
import { V_ZERKALE_HUB_PATH } from "./v-zerkale-cluster";
import { V_SPORTALE_HUB_PATH } from "./v-sportale-cluster";
import { MOTOTSIKL_HUB_PATH } from "./mototsikl-cluster";
import { S_TORTOM_HUB_PATH } from "./s-tortom-cluster";
import { S_LOSHADYU_HUB_PATH } from "./s-loshadyu-cluster";
import { V_LESU_HUB_PATH } from "./v-lesu-cluster";

test("dispatcher resolves exact hub paths only", () => {
  assert.equal(
    resolveListingCatalogHub("/promty-dlya-foto-par")?.path,
    PROMTY_DLYA_FOTO_PAR_HUB_PATH,
  );
  assert.equal(
    resolveListingCatalogHub("/promty-dlya-foto-devushki/")?.path,
    PROMTY_DLYA_FOTO_DEVUSHKI_HUB_PATH,
  );
  assert.equal(
    resolveListingCatalogHub("/promty-dlya-foto-muzhchiny/")?.path,
    PROMTY_DLYA_FOTO_MUZHCHINY_HUB_PATH,
  );
  assert.equal(resolveListingCatalogHub("/osen/")?.path, OSEN_HUB_PATH);
  assert.equal(resolveListingCatalogHub("/v-forme/")?.path, V_FORME_HUB_PATH);
  assert.equal(resolveListingCatalogHub("/promty-dlya-foto/s-mashinoy/")?.path, S_MASHINOY_HUB_PATH);
  assert.equal(resolveListingCatalogHub("/promty-dlya-foto/na-avatarku/")?.path, AVATAR_HUB_PATH);
  assert.equal(resolveListingCatalogHub("/promty-dlya-foto/na-more/")?.path, NA_MORE_HUB_PATH);
  assert.equal(resolveListingCatalogHub("/promty-dlya-foto/v-mashine/")?.path, V_MASHINE_HUB_PATH);
  assert.equal(resolveListingCatalogHub("/promty-dlya-foto/s-shampanskim/")?.path, S_SHAMPANSKIM_HUB_PATH);
  assert.equal(resolveListingCatalogHub("/promty-dlya-foto/v-zerkale/")?.path, V_ZERKALE_HUB_PATH);
  assert.equal(resolveListingCatalogHub("/promty-dlya-foto/v-sportale/")?.path, V_SPORTALE_HUB_PATH);
  assert.equal(resolveListingCatalogHub("/promty-dlya-foto/mototsikl/")?.path, MOTOTSIKL_HUB_PATH);
  assert.equal(resolveListingCatalogHub("/promty-dlya-foto/s-tortom/")?.path, S_TORTOM_HUB_PATH);
  assert.equal(resolveListingCatalogHub("/promty-dlya-foto/s-loshadyu/")?.path, S_LOSHADYU_HUB_PATH);
  assert.equal(resolveListingCatalogHub("/promty-dlya-foto/v-lesu/")?.path, V_LESU_HUB_PATH);
  assert.equal(resolveListingCatalogHub("/v-mashine"), null);
  assert.equal(resolveListingCatalogHub("/na-more"), null);
  assert.equal(resolveListingCatalogHub("/foto-na-avatarku"), null);
  assert.equal(resolveListingCatalogHub("/s-mashinoy"), null);
  assert.equal(resolveListingCatalogHub("/v-forme/portret"), null);
  assert.ok(resolveListingCatalogHubL1("/v-forme", 1));
  assert.equal(resolveListingCatalogHub("/osen/portret"), null);
  assert.ok(resolveListingCatalogHubL1("/osen", 1));
  assert.equal(resolveListingCatalogHub("/promty-dlya-foto-par/portret"), null);
  assert.equal(
    resolveListingCatalogHub("/promty-dlya-foto-devushki/s-cvetami"),
    null,
  );
  assert.equal(
    resolveListingCatalogHub("/promty-dlya-foto-muzhchiny/s-mashinoy"),
    null,
  );
  assert.equal(resolveListingCatalogHubL1("/promty-dlya-foto-devushki", 2), null);
  assert.ok(resolveListingCatalogHubL1("/promty-dlya-foto-devushki", 1));
  assert.ok(resolveListingCatalogHubL1("/promty-dlya-foto-muzhchiny", 1));
});

test("one redirect predicate covers catalog hubs", () => {
  assert.equal(
    listingCatalogHubChildRedirectPath("/promty-dlya-foto-par/osen"),
    PROMTY_DLYA_FOTO_PAR_HUB_PATH,
  );
  assert.equal(
    listingCatalogHubChildRedirectPath("/promty-dlya-foto-devushki/portret"),
    PROMTY_DLYA_FOTO_DEVUSHKI_HUB_PATH,
  );
  assert.equal(
    listingCatalogHubChildRedirectPath("/promty-dlya-foto-muzhchiny/s-mashinoy"),
    PROMTY_DLYA_FOTO_MUZHCHINY_HUB_PATH,
  );
  assert.equal(
    listingCatalogHubChildRedirectPath("/promty-dlya-foto-devushki/den-rozhdeniya"),
    null,
  );
  assert.equal(
    listingCatalogHubChildRedirectPath("/promty-dlya-foto-muzhchiny/den-rozhdeniya"),
    null,
  );
  assert.equal(isListingCatalogHubClusterPath("/promty-dlya-foto-par"), true);
  assert.equal(
    isListingCatalogHubClusterPath("/promty-dlya-foto-devushki/s-cvetami"),
    true,
  );
  assert.equal(isListingCatalogHubClusterPath("/promty-dlya-foto-muzhchiny"), true);
  assert.equal(
    listingCatalogHubChildRedirectPath("/osen/v-lesu"),
    OSEN_HUB_PATH,
  );
  assert.equal(isListingCatalogHubClusterPath("/osen"), true);
  assert.equal(
    listingCatalogHubChildRedirectPath("/v-forme/portret"),
    V_FORME_HUB_PATH,
  );
  assert.equal(isListingCatalogHubClusterPath("/v-forme"), true);
  assert.equal(listingCatalogHubChildRedirectPath("/s-mashinoy"), S_MASHINOY_HUB_PATH);
  assert.equal(
    listingCatalogHubChildRedirectPath("/promty-dlya-foto/s-mashinoy/portret"),
    S_MASHINOY_HUB_PATH,
  );
  assert.equal(isListingCatalogHubClusterPath("/promty-dlya-foto/s-mashinoy"), true);
  assert.equal(listingCatalogHubChildRedirectPath("/foto-na-avatarku"), AVATAR_HUB_PATH);
  assert.equal(isListingCatalogHubClusterPath("/promty-dlya-foto/na-avatarku"), true);
  assert.equal(listingCatalogHubChildRedirectPath("/na-more"), NA_MORE_HUB_PATH);
  assert.equal(isListingCatalogHubClusterPath("/promty-dlya-foto/na-more"), true);
  assert.equal(listingCatalogHubChildRedirectPath("/v-mashine"), V_MASHINE_HUB_PATH);
  assert.equal(listingCatalogHubChildRedirectPath("/s-shampanskim"), S_SHAMPANSKIM_HUB_PATH);
  assert.equal(listingCatalogHubChildRedirectPath("/v-zerkale"), V_ZERKALE_HUB_PATH);
  assert.equal(listingCatalogHubChildRedirectPath("/v-sportale"), V_SPORTALE_HUB_PATH);
  assert.equal(listingCatalogHubChildRedirectPath("/mototsikl"), MOTOTSIKL_HUB_PATH);
  assert.equal(listingCatalogHubChildRedirectPath("/s-tortom"), S_TORTOM_HUB_PATH);
  assert.equal(listingCatalogHubChildRedirectPath("/s-loshadyu"), S_LOSHADYU_HUB_PATH);
  assert.equal(listingCatalogHubChildRedirectPath("/v-lesu"), V_LESU_HUB_PATH);
  assert.equal(
    listingCatalogHubChildRedirectPath("/promty-dlya-foto-par/v-mashine"),
    "/promty-dlya-foto-par",
  );
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
  assert.equal(
    listingCatalogHubGenerateCta("/promty-dlya-foto-muzhchiny"),
    "Создать фото мужчины",
  );
  assert.equal(listingCatalogHubGenerateCta("/"), null);
  assert.equal(isListingCatalogHubGenerateCta("Создать фото мужчины"), true);
  assert.equal(
    listingCatalogHubGenerateCta("/osen"),
    "Создать осеннее фото",
  );
  assert.equal(
    listingCatalogHubGenerateCta("/v-forme"),
    "Создать фото в форме",
  );
  assert.equal(
    listingCatalogHubGenerateCta("/promty-dlya-foto/s-mashinoy"),
    "Создать фото с машиной",
  );
  assert.equal(
    listingCatalogHubGenerateCta("/promty-dlya-foto/na-avatarku"),
    "Создать фото на аватарку",
  );
  assert.equal(
    listingCatalogHubGenerateCta("/promty-dlya-foto/na-more"),
    "Создать фото на море",
  );
  assert.equal(
    listingCatalogHubGenerateCta("/promty-dlya-foto/v-mashine"),
    "Создать фото в машине",
  );
  assert.equal(
    listingCatalogHubGenerateCta("/promty-dlya-foto/s-shampanskim"),
    "Создать фото с шампанским",
  );
  assert.equal(
    listingCatalogHubGenerateCta("/promty-dlya-foto/v-zerkale"),
    "Создать фото в зеркале",
  );
  assert.equal(
    listingCatalogHubGenerateCta("/promty-dlya-foto/v-sportale"),
    "Создать фото в спортзале",
  );
  assert.equal(
    listingCatalogHubGenerateCta("/promty-dlya-foto/mototsikl"),
    "Создать фото на мотоцикле",
  );
  assert.equal(
    listingCatalogHubGenerateCta("/promty-dlya-foto/s-tortom"),
    "Создать фото с тортом",
  );
  assert.equal(
    listingCatalogHubGenerateCta("/promty-dlya-foto/s-loshadyu"),
    "Создать фото с лошадью",
  );
  assert.equal(
    listingCatalogHubGenerateCta("/promty-dlya-foto/v-lesu"),
    "Создать фото в лесу",
  );
  assert.equal(isListingCatalogHubGenerateCta("Создать фото"), false);
});
