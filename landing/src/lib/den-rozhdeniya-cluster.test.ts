import assert from "node:assert/strict";
import test from "node:test";
import { findTagBySlug } from "./tag-registry";
import {
  DEN_ROZHDENIYA_HUB_PATH,
  DEN_ROZHDENIYA_PERMANENT_REDIRECTS,
  DEN_ROZHDENIYA_SEARCH_QUERY,
  birthdayAliasForAudienceSlug,
  birthdayClusterSitemapPages,
  birthdayListingSearchQueries,
  birthdayListingSearchQuery,
  isBirthdayListingSearchQuery,
  buildBirthdayClusterCanonical,
  getFeaturedBirthdayNavItems,
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

  const cakeGirl = resolveDenRozhdeniyaClusterSegments([
    "sobytiya",
    "den-rozhdeniya",
    "devushki",
    "s-tortom",
  ]);
  assert.ok(cakeGirl);
  assert.equal(cakeGirl.level, 3);
  assert.equal(
    cakeGirl.canonicalPath,
    "/sobytiya/den-rozhdeniya/devushki/s-tortom",
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
    sources.filter((source) => !source.includes(":object")),
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

test("audience-first L3 permanently redirects onto hub children", () => {
  const girlCake = DEN_ROZHDENIYA_PERMANENT_REDIRECTS.find(
    (item) => item.source === "/promty-dlya-foto-devushki/den-rozhdeniya/:object",
  );
  assert.deepEqual(girlCake, {
    source: "/promty-dlya-foto-devushki/den-rozhdeniya/:object",
    destination: "/sobytiya/den-rozhdeniya/devushki/:object",
  });
  const girlCakeLast = DEN_ROZHDENIYA_PERMANENT_REDIRECTS.find(
    (item) =>
      item.source === "/promty-dlya-foto-devushki/:object/den-rozhdeniya",
  );
  assert.deepEqual(girlCakeLast, {
    source: "/promty-dlya-foto-devushki/:object/den-rozhdeniya",
    destination: "/sobytiya/den-rozhdeniya/devushki/:object",
  });
  const manObject = DEN_ROZHDENIYA_PERMANENT_REDIRECTS.find(
    (item) => item.source === "/promty-dlya-foto-muzhchiny/den-rozhdeniya/:object",
  );
  assert.equal(
    manObject?.destination,
    "/sobytiya/den-rozhdeniya/muzhchiny/:object",
  );
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

test("listing query is search text, not a tag filter", () => {
  const occasion = findTagBySlug("occasion_tag", "den_rozhdeniya");
  const girl = findTagBySlug("audience_tag", "devushka");
  const boy = findTagBySlug("audience_tag", "malchik");
  const cake = findTagBySlug("object_tag", "s_tortom");
  assert.ok(occasion && girl && boy && cake);
  assert.equal(birthdayListingSearchQuery([occasion]), DEN_ROZHDENIYA_SEARCH_QUERY);
  assert.equal(
    birthdayListingSearchQuery([occasion, girl]),
    "день рождения девушке",
  );
  assert.equal(
    birthdayListingSearchQuery([occasion, boy]),
    "день рождения ребенка",
  );
  const man = findTagBySlug("audience_tag", "muzhchina");
  const champagne = findTagBySlug("object_tag", "s_shampanskim");
  const lion = findTagBySlug("object_tag", "so_lvom");
  assert.ok(man && champagne && lion);
  assert.equal(
    birthdayListingSearchQuery([occasion, man]),
    "мужской день рождения",
  );
  assert.equal(birthdayListingSearchQuery([occasion, cake]), "с тортом");
  assert.equal(
    birthdayListingSearchQuery([occasion, champagne]),
    "с шампанским",
  );
  assert.equal(birthdayListingSearchQuery([occasion, lion]), "со львом");
  assert.equal(
    birthdayListingSearchQuery([occasion, girl, cake]),
    "день рождения девушке с тортом",
  );
  assert.equal(
    birthdayListingSearchQuery([occasion, man, cake]),
    "день рождения мужчине с тортом",
  );
  assert.equal(birthdayListingSearchQuery([girl]), null);
});

test("hybrid listing allowlist is the birthday SSOT, not arbitrary search", () => {
  const queries = birthdayListingSearchQueries();
  for (const query of [
    DEN_ROZHDENIYA_SEARCH_QUERY,
    "день рождения девушке",
    "день рождения ребенка",
    "мужской день рождения",
    "с тортом",
    "день рождения девушке с тортом",
  ]) {
    assert.equal(queries.includes(query), true, query);
    assert.equal(isBirthdayListingSearchQuery(query), true, query);
  }
  assert.equal(isBirthdayListingSearchQuery("ночной портрет"), false);
  assert.equal(isBirthdayListingSearchQuery("день рождения"), true);
});

test("sitemap pages follow SSOT listing queries, including L3", () => {
  const pages = birthdayClusterSitemapPages();
  const byPath = new Map(pages.map((page) => [page.path, page]));
  assert.deepEqual(byPath.get("/sobytiya/den-rozhdeniya"), {
    path: "/sobytiya/den-rozhdeniya",
    query: DEN_ROZHDENIYA_SEARCH_QUERY,
    level: 1,
  });
  assert.deepEqual(byPath.get("/sobytiya/den-rozhdeniya/muzhchiny"), {
    path: "/sobytiya/den-rozhdeniya/muzhchiny",
    query: "мужской день рождения",
    level: 2,
  });
  assert.deepEqual(byPath.get("/sobytiya/den-rozhdeniya/devushki/s-tortom"), {
    path: "/sobytiya/den-rozhdeniya/devushki/s-tortom",
    query: "день рождения девушке с тортом",
    level: 3,
  });
  assert.equal(
    pages.filter((page) => page.level === 2).length,
    7,
  );
  assert.equal(
    pages.filter((page) => page.level === 3).length,
    12,
  );
});
