import assert from "node:assert/strict";
import test from "node:test";
import {
  birthdayAdLandingPath,
  birthdayAdTitle,
  isPaidAdClickSearch,
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

test("ad title applies only on the hub with a paid click", () => {
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
  assert.equal(
    resolveAdLandingTitle({
      path: "/sobytiya/den-rozhdeniya",
      search: "",
    }),
    null,
  );
  assert.equal(
    resolveAdLandingTitle({
      path: "/sobytiya/den-rozhdeniya/devushki",
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
