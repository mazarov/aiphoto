import assert from "node:assert/strict";
import test from "node:test";
import {
  birthdayAdLandingPath,
  birthdayAdTitle,
  isPaidAdClickSearch,
  pairsGenerateAdTitle,
  pairsPromptsAdTitle,
  resolveAdLandingTitle,
} from "./ad-landing-title";

const AD_SEARCH =
  "utm_source=yandex&utm_medium=cpc&utm_campaign=999000823&utm_content=999000001&utm_term=создать+фото+на+день+рождения&yclid=2026082306420000001";

test("birthday ad landing is the events hub", () => {
  assert.equal(birthdayAdLandingPath(), "/sobytiya/den-rozhdeniya");
  assert.equal(
    birthdayAdTitle(),
    "Создайте фото на день рождения с ИИ по вашему фото",
  );
});

test("paid ad click is yclid or yandex cpc, not a cookie leftover", () => {
  assert.equal(isPaidAdClickSearch(AD_SEARCH), true);
  assert.equal(isPaidAdClickSearch("yclid=2026082306420000001"), true);
  assert.equal(
    isPaidAdClickSearch("utm_source=yandex&utm_medium=cpc"),
    true,
  );
  assert.equal(isPaidAdClickSearch("utm_source=yandex"), false);
  assert.equal(isPaidAdClickSearch("utm_medium=cpc"), false);
  assert.equal(isPaidAdClickSearch(""), false);
});

test("ad title applies on the birthday cluster with a paid click", () => {
  assert.equal(
    resolveAdLandingTitle({
      path: "/sobytiya/den-rozhdeniya",
      search: AD_SEARCH,
    }),
    birthdayAdTitle(),
  );
  assert.equal(
    resolveAdLandingTitle({
      path: "/sobytiya/den-rozhdeniya/",
      search: "?yclid=2026082306420000001",
    }),
    birthdayAdTitle(),
  );
  for (const path of [
    "/sobytiya/den-rozhdeniya/devushki",
    "/sobytiya/den-rozhdeniya/deti",
    "/sobytiya/den-rozhdeniya/muzhchiny",
    "/sobytiya/den-rozhdeniya/s-tortom",
    "/sobytiya/den-rozhdeniya/s-detskim-foto",
    "/sobytiya/den-rozhdeniya/s-shampanskim",
    "/sobytiya/den-rozhdeniya/devushki/s-tortom",
  ]) {
    assert.equal(
      resolveAdLandingTitle({ path, search: AD_SEARCH }),
      birthdayAdTitle(),
      path,
    );
  }
  assert.equal(
    resolveAdLandingTitle({
      path: "/sobytiya/den-rozhdeniya",
      search: "",
    }),
    null,
  );
  assert.equal(
    resolveAdLandingTitle({
      path: "/sobytiya/8-marta",
      search: AD_SEARCH,
    }),
    null,
  );
  assert.equal(
    resolveAdLandingTitle({
      path: "/generaciya-foto/na-den-rozhdeniya",
      search: AD_SEARCH,
    }),
    null,
  );
});

test("pairs prompt ad title applies on catalog, children and sitelinks", () => {
  assert.equal(pairsPromptsAdTitle(), "Промты для фото пары с ИИ");
  for (const path of [
    "/promty-dlya-foto-par",
    "/promty-dlya-foto-par/",
    "/promty-dlya-foto-par/cherno-beloe",
    "/promty-dlya-foto-s-parnem",
    "/promty-dlya-foto-s-muzhem",
    "/promty-dlya-foto-vlyublennykh",
  ]) {
    assert.equal(
      resolveAdLandingTitle({ path, search: AD_SEARCH }),
      pairsPromptsAdTitle(),
      path,
    );
  }
  assert.equal(
    resolveAdLandingTitle({
      path: "/promty-dlya-foto-par",
      search: "",
    }),
    null,
  );
  assert.equal(
    resolveAdLandingTitle({
      path: "/promty-dlya-foto-devushki",
      search: AD_SEARCH,
    }),
    null,
  );
});

test("pairs generate ad title applies only on /generaciya-foto/pary", () => {
  assert.equal(
    pairsGenerateAdTitle(),
    "Сделайте парное фото с ИИ по вашим фото",
  );
  assert.equal(
    resolveAdLandingTitle({
      path: "/generaciya-foto/pary",
      search: AD_SEARCH,
    }),
    pairsGenerateAdTitle(),
  );
  assert.equal(
    resolveAdLandingTitle({
      path: "/generaciya-foto/pary/",
      search: "yclid=2026082306420000001",
    }),
    pairsGenerateAdTitle(),
  );
  assert.equal(
    resolveAdLandingTitle({
      path: "/generaciya-foto/pary",
      search: "",
    }),
    null,
  );
  assert.equal(
    resolveAdLandingTitle({
      path: "/generaciya-foto/semya",
      search: AD_SEARCH,
    }),
    null,
  );
});
