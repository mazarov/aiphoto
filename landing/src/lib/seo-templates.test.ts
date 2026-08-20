import assert from "node:assert/strict";
import test from "node:test";
import { getSeoForRoute } from "./seo-templates";
import { resolveUrlToTags } from "./route-resolver";

test("birthday hub keeps the existing H1", () => {
  const route = resolveUrlToTags(["sobytiya", "den-rozhdeniya"]);
  assert.ok(route);
  const seo = getSeoForRoute(route);
  assert.equal(seo.h1, "Промты для фото на день рождения");
  assert.match(seo.metaTitle, /Промты для фото на день рождения/);
  assert.ok(seo.popularLinks?.some((link) => link.href.endsWith("/devushki")));
});

test("manual combo SEO wins over L2 templates", () => {
  const route = resolveUrlToTags(["sobytiya", "den-rozhdeniya", "devushki"]);
  assert.ok(route);
  const seo = getSeoForRoute(route);
  assert.equal(seo.h1, "Промт на день рождения девушке");
  assert.match(seo.metaTitle, /девушке/);
});

test("man and kids children use manual copy", () => {
  const man = resolveUrlToTags(["sobytiya", "den-rozhdeniya", "muzhchiny"]);
  const kids = resolveUrlToTags(["sobytiya", "den-rozhdeniya", "deti"]);
  assert.ok(man && kids);
  assert.equal(getSeoForRoute(man).h1, "Промт на день рождения мужчине");
  assert.equal(getSeoForRoute(kids).h1, "Промты на детский день рождения");
});

test("birthday titles do not steal sibling cluster queries", () => {
  const hub = getSeoForRoute(resolveUrlToTags(["sobytiya", "den-rozhdeniya"])!);
  const girl = getSeoForRoute(
    resolveUrlToTags(["sobytiya", "den-rozhdeniya", "devushki"])!,
  );
  const kids = getSeoForRoute(
    resolveUrlToTags(["sobytiya", "den-rozhdeniya", "deti"])!,
  );
  const cake = getSeoForRoute(
    resolveUrlToTags(["sobytiya", "den-rozhdeniya", "s-tortom"])!,
  );
  const thenNow = getSeoForRoute(
    resolveUrlToTags(["sobytiya", "den-rozhdeniya", "s-detskim-foto"])!,
  );
  const girlCake = getSeoForRoute(
    resolveUrlToTags(["sobytiya", "den-rozhdeniya", "devushki", "s-tortom"])!,
  );

  const hubHead = `${hub.metaTitle} ${hub.metaDescription}`;
  assert.doesNotMatch(hubHead, /девушке|детям|мужчине|с тортом|сделать фото/i);
  assert.doesNotMatch(`${girl.metaTitle} ${girl.metaDescription}`, /с тортом/i);
  assert.doesNotMatch(
    `${kids.metaTitle} ${kids.metaDescription}`,
    /с собой маленьк|тогда и сейчас/i,
  );
  assert.doesNotMatch(`${cake.metaTitle} ${cake.metaDescription}`, /девушке/i);
  assert.doesNotMatch(
    `${thenNow.metaTitle} ${thenNow.metaDescription}`,
    /детский день рождения/i,
  );
  assert.match(girlCake.metaTitle, /девушке с тортом/);
});
