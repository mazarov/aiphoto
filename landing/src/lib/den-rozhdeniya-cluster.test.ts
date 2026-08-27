import assert from "node:assert/strict";
import test from "node:test";
import { findTagBySlug } from "./tag-registry";
import {
  DEN_ROZHDENIYA_HUB_PATH,
  DEN_ROZHDENIYA_PERMANENT_REDIRECTS,
  birthdayAliasForAudienceSlug,
  birthdayClusterSitemapPages,
  birthdayListingSearchFilters,
  birthdayListingSearchQueries,
  birthdayListingSearchQuery,
  birthdayRetiredL3RedirectPath,
  isBirthdayListingSearchQuery,
  buildBirthdayClusterCanonical,
  getFeaturedBirthdayNavItems,
  isFeaturedBirthdayChildAlias,
  isDenRozhdeniyaClusterPath,
  isDenRozhdeniyaHubPath,
  resolveDenRozhdeniyaClusterSegments,
  seoComboKey,
} from "./den-rozhdeniya-cluster";

test("hub path stays under /sobytiya/den-rozhdeniya", () => {
  assert.equal(DEN_ROZHDENIYA_HUB_PATH, "/sobytiya/den-rozhdeniya");
  assert.equal(isDenRozhdeniyaHubPath("/sobytiya/den-rozhdeniya"), true);
  assert.equal(isDenRozhdeniyaHubPath("/sobytiya/den-rozhdeniya/"), true);
  assert.equal(isDenRozhdeniyaClusterPath("/sobytiya/den-rozhdeniya/devushki"), true);
  assert.equal(isDenRozhdeniyaHubPath("/den-rozhdeniya"), false);
});

test("audience aliases map girl, kids and man", () => {
  assert.equal(birthdayAliasForAudienceSlug("devushka"), "devushki");
  assert.equal(birthdayAliasForAudienceSlug("detskie"), "deti");
  assert.equal(birthdayAliasForAudienceSlug("muzhchina"), "muzhchiny");
  assert.equal(birthdayAliasForAudienceSlug("malchik"), "deti");
  assert.equal(birthdayAliasForAudienceSlug("devochka"), "deti");
  assert.equal(birthdayAliasForAudienceSlug("malysh"), "deti");
});

test("canonical for audience + birthday is occasion-first", () => {
  const occasion = findTagBySlug("occasion_tag", "den_rozhdeniya");
  const girl = findTagBySlug("audience_tag", "devushka");
  const boy = findTagBySlug("audience_tag", "malchik");
  const cake = findTagBySlug("object_tag", "s_tortom");
  assert.ok(occasion && girl && boy && cake);
  assert.equal(
    buildBirthdayClusterCanonical([girl, occasion]),
    "/sobytiya/den-rozhdeniya/devushki",
  );
  assert.equal(
    buildBirthdayClusterCanonical([boy, occasion]),
    "/sobytiya/den-rozhdeniya/deti",
  );
  assert.equal(
    buildBirthdayClusterCanonical([occasion, cake]),
    "/sobytiya/den-rozhdeniya/s-tortom",
  );
  assert.equal(
    buildBirthdayClusterCanonical([occasion, girl, cake]),
    "/sobytiya/den-rozhdeniya/devushki",
  );
});

test("short child slugs resolve under the hub", () => {
  const girl = resolveDenRozhdeniyaClusterSegments([
    "sobytiya",
    "den-rozhdeniya",
    "devushki",
  ]);
  assert.ok(girl);
  assert.equal(girl.level, 2);
  assert.equal(girl.canonicalPath, "/sobytiya/den-rozhdeniya/devushki");
  assert.equal(girl.parentPath, DEN_ROZHDENIYA_HUB_PATH);
  assert.equal(girl.primaryTag.slug, "den_rozhdeniya");
  assert.deepEqual(
    girl.tags.map((tag) => tag.slug).sort(),
    ["den_rozhdeniya", "devushka"].sort(),
  );

  assert.equal(
    resolveDenRozhdeniyaClusterSegments([
      "sobytiya",
      "den-rozhdeniya",
      "devushki",
      "s-tortom",
    ]),
    null,
  );
});

test("retired L3 paths redirect to audience L2", () => {
  assert.equal(
    birthdayRetiredL3RedirectPath([
      "sobytiya",
      "den-rozhdeniya",
      "devushki",
      "s-tortom",
    ]),
    "/sobytiya/den-rozhdeniya/devushki",
  );
  assert.equal(
    birthdayRetiredL3RedirectPath([
      "sobytiya",
      "den-rozhdeniya",
      "s-tortom",
      "devushki",
    ]),
    "/sobytiya/den-rozhdeniya/devushki",
  );
  assert.equal(
    birthdayRetiredL3RedirectPath([
      "sobytiya",
      "den-rozhdeniya",
      "s-tortom",
      "s-shampanskim",
    ]),
    "/sobytiya/den-rozhdeniya/s-tortom",
  );
  assert.equal(
    birthdayRetiredL3RedirectPath(["sobytiya", "den-rozhdeniya", "devushki"]),
    null,
  );
});

test("hub itself is not in the 301 list", () => {
  assert.equal(
    DEN_ROZHDENIYA_PERMANENT_REDIRECTS.some(
      (item) => item.source === DEN_ROZHDENIYA_HUB_PATH,
    ),
    false,
  );
  const sources = DEN_ROZHDENIYA_PERMANENT_REDIRECTS.map((item) => item.source);
  assert.deepEqual(
    sources.filter(
      (source) =>
        source.startsWith("/promty-") &&
        !source.includes(":object") &&
        !source.includes("/s-"),
    ),
    [
      "/promty-dlya-foto-devushki/den-rozhdeniya",
      "/promty-dlya-detskih-foto/den-rozhdeniya",
      "/promty-dlya-foto-muzhchiny/den-rozhdeniya",
      "/promty-dlya-foto-malchika/den-rozhdeniya",
      "/promty-dlya-foto-devochka/den-rozhdeniya",
      "/promty-dlya-foto-malysh/den-rozhdeniya",
    ],
  );
});

test("audience-first L3 permanently redirects onto audience L2", () => {
  const girlCake = DEN_ROZHDENIYA_PERMANENT_REDIRECTS.find(
    (item) => item.source === "/promty-dlya-foto-devushki/den-rozhdeniya/:object",
  );
  assert.deepEqual(girlCake, {
    source: "/promty-dlya-foto-devushki/den-rozhdeniya/:object",
    destination: "/sobytiya/den-rozhdeniya/devushki",
  });
  const girlCakeLast = DEN_ROZHDENIYA_PERMANENT_REDIRECTS.find(
    (item) =>
      item.source === "/promty-dlya-foto-devushki/:object/den-rozhdeniya",
  );
  assert.deepEqual(girlCakeLast, {
    source: "/promty-dlya-foto-devushki/:object/den-rozhdeniya",
    destination: "/sobytiya/den-rozhdeniya/devushki",
  });
  const manObject = DEN_ROZHDENIYA_PERMANENT_REDIRECTS.find(
    (item) => item.source === "/promty-dlya-foto-muzhchiny/den-rozhdeniya/:object",
  );
  assert.equal(
    manObject?.destination,
    "/sobytiya/den-rozhdeniya/muzhchiny",
  );
});

test("cluster L3 wildcards permanently redirect onto L2", () => {
  const girlWildcard = DEN_ROZHDENIYA_PERMANENT_REDIRECTS.find(
    (item) => item.source === "/sobytiya/den-rozhdeniya/devushki/:object",
  );
  assert.deepEqual(girlWildcard, {
    source: "/sobytiya/den-rozhdeniya/devushki/:object",
    destination: "/sobytiya/den-rozhdeniya/devushki",
  });
  const cakeGirl = DEN_ROZHDENIYA_PERMANENT_REDIRECTS.find(
    (item) => item.source === "/sobytiya/den-rozhdeniya/s-tortom/devushki",
  );
  assert.deepEqual(cakeGirl, {
    source: "/sobytiya/den-rozhdeniya/s-tortom/devushki",
    destination: "/sobytiya/den-rozhdeniya/devushki",
  });
});

test("featured birthday child aliases include collapsed deti", () => {
  assert.equal(isFeaturedBirthdayChildAlias("deti"), true);
  assert.equal(isFeaturedBirthdayChildAlias("devushki"), true);
  assert.equal(isFeaturedBirthdayChildAlias("semya"), false);
});

test("featured nav starts with Все back to the hub", () => {
  const hubItems = getFeaturedBirthdayNavItems();
  assert.deepEqual(hubItems[0], {
    label: "Все",
    href: DEN_ROZHDENIYA_HUB_PATH,
    active: true,
  });
  assert.equal(
    hubItems.some((item) => item.href === "/generaciya-foto/na-den-rozhdeniya"),
    false,
  );
  assert.ok(hubItems.some((item) => item.href === "/sobytiya/den-rozhdeniya/devushki"));
  assert.equal(
    hubItems.find((item) => item.href === "/sobytiya/den-rozhdeniya/devushki")?.label,
    "Девушки",
  );
  assert.equal(
    hubItems.find((item) => item.href === "/sobytiya/den-rozhdeniya/deti")?.label,
    "Дети",
  );
  assert.equal(
    hubItems.find((item) => item.href === "/sobytiya/den-rozhdeniya/muzhchiny")?.label,
    "Мужчина",
  );

  const childItems = getFeaturedBirthdayNavItems("devushki");
  assert.equal(childItems[0].href, DEN_ROZHDENIYA_HUB_PATH);
  assert.equal(childItems[0].active, false);
  assert.equal(
    childItems.find((item) => item.href === "/sobytiya/den-rozhdeniya/devushki")
      ?.active,
    true,
  );
});

test("seo combo key follows dimension priority", () => {
  const occasion = findTagBySlug("occasion_tag", "den_rozhdeniya");
  const girl = findTagBySlug("audience_tag", "devushka");
  assert.ok(occasion && girl);
  assert.equal(seoComboKey([occasion, girl]), "devushka+den_rozhdeniya");
});

test("hub, girl and cake stay on tags; kids and weak L2 stay on search", () => {
  const occasion = findTagBySlug("occasion_tag", "den_rozhdeniya");
  const girl = findTagBySlug("audience_tag", "devushka");
  const boy = findTagBySlug("audience_tag", "malchik");
  const cake = findTagBySlug("object_tag", "s_tortom");
  const man = findTagBySlug("audience_tag", "muzhchina");
  const thenNow = findTagBySlug("object_tag", "s_detskim_foto");
  const champagne = findTagBySlug("object_tag", "s_shampanskim");
  const lion = findTagBySlug("object_tag", "so_lvom");
  assert.ok(occasion && girl && boy && cake && man && thenNow && champagne && lion);
  assert.equal(birthdayListingSearchQuery([occasion]), null);
  assert.equal(birthdayListingSearchQuery([occasion, girl]), null);
  assert.equal(
    birthdayListingSearchQuery([occasion, boy]),
    "дети день рождения",
  );
  assert.equal(birthdayListingSearchQuery([occasion, cake]), null);
  assert.equal(
    birthdayListingSearchQuery([occasion, findTagBySlug("audience_tag", "detskie")!]),
    "дети день рождения",
  );
  assert.equal(
    birthdayListingSearchQuery([occasion, man]),
    "мужской день рождения",
  );
  assert.equal(
    birthdayListingSearchQuery([occasion, thenNow]),
    "день рождения с детским фото",
  );
  assert.equal(birthdayListingSearchQuery([occasion, champagne]), "с шампанским");
  assert.equal(birthdayListingSearchQuery([occasion, lion]), "со львом");
  assert.equal(birthdayListingSearchQuery([occasion, girl, cake]), null);
  assert.equal(birthdayListingSearchQuery([girl]), null);
  assert.deepEqual(birthdayListingSearchFilters([occasion, man]), {});
  assert.deepEqual(birthdayListingSearchFilters([occasion, girl]), {
    audience_tag: "devushka",
  });
});

test("hybrid listing allowlist is only search-backed L2", () => {
  const queries = birthdayListingSearchQueries();
  assert.deepEqual(queries, [
    "дети день рождения",
    "мужской день рождения",
    "день рождения с детским фото",
    "с шампанским",
    "со львом",
  ]);
  assert.equal(isBirthdayListingSearchQuery("день рождения"), false);
  assert.equal(isBirthdayListingSearchQuery("детский день рождения"), false);
  assert.equal(isBirthdayListingSearchQuery("дети день рождения"), true);
  assert.equal(isBirthdayListingSearchQuery("мужской день рождения"), true);
  assert.equal(isBirthdayListingSearchQuery("с шампанским"), true);
  assert.equal(isBirthdayListingSearchQuery("день рождения девушке"), false);
  assert.equal(isBirthdayListingSearchQuery("с тортом"), false);
  assert.equal(isBirthdayListingSearchQuery("ночной портрет"), false);
});

test("search-backed sitemap is weak L2 only", () => {
  const pages = birthdayClusterSitemapPages();
  const byPath = new Map(pages.map((page) => [page.path, page]));
  assert.equal(byPath.has("/sobytiya/den-rozhdeniya"), false);
  assert.deepEqual(byPath.get("/sobytiya/den-rozhdeniya/muzhchiny"), {
    path: "/sobytiya/den-rozhdeniya/muzhchiny",
    query: "мужской день рождения",
    filters: {},
    level: 2,
  });
  assert.deepEqual(byPath.get("/sobytiya/den-rozhdeniya/deti"), {
    path: "/sobytiya/den-rozhdeniya/deti",
    query: "дети день рождения",
    filters: {},
    level: 2,
  });
  assert.equal(byPath.has("/sobytiya/den-rozhdeniya/devushki"), false);
  assert.equal(byPath.has("/sobytiya/den-rozhdeniya/s-tortom"), false);
  assert.equal(byPath.has("/sobytiya/den-rozhdeniya/devushki/s-tortom"), false);
  assert.equal(pages.filter((page) => page.level === 2).length, 5);
  assert.equal(pages.some((page) => page.level === 1), false);
});
