/** `npx tsx --conditions react-server --test src/lib/school-day-hubs.test.ts` — pulls server-only tag-patterns. */
import assert from "node:assert/strict";
import test from "node:test";
import { patternsForTag } from "./tag-patterns";
import { findTagBySlug } from "./tag-registry";
import { resolveUrlToTags } from "./route-resolver";
import { getSeoForRoute } from "./seo-templates";
import {
  listingCatalogHubChildRedirectPath,
  listingCatalogHubGenerateCta,
  resolveListingCatalogHub,
} from "./listing-catalog-hub";
import {
  DEN_UCHITELYA_HUB_PATH,
  DEN_VOSPITATELYA_HUB_PATH,
  SCHOOL_DAY_HUB_SPECS,
  applySchoolDayListingCount,
  schoolDayFilterNav,
  schoolDayHubHeroFetchParams,
} from "./school-day-hubs";

test("school day hubs are born on the new path and keep the occasion tag", () => {
  assert.equal(SCHOOL_DAY_HUB_SPECS.length, 2);
  for (const spec of SCHOOL_DAY_HUB_SPECS) {
    const segments = spec.hubPath.split("/").filter(Boolean);
    const route = resolveUrlToTags(segments);
    assert.ok(route);
    assert.equal(route.level, 1);
    assert.equal(route.canonicalPath, spec.hubPath);
    assert.equal(route.rpcParams.occasion_tag, spec.slug);
    assert.equal(route.rpcParams.audience_tag, null);
    assert.equal(resolveListingCatalogHub(spec.hubPath)?.path, spec.hubPath);
    assert.equal(listingCatalogHubChildRedirectPath(spec.hubPath), null);
    assert.equal(
      listingCatalogHubChildRedirectPath(`${spec.hubPath}/portret`),
      spec.hubPath,
    );
    assert.equal(listingCatalogHubGenerateCta(spec.hubPath), spec.generateCta);
    assert.equal(schoolDayFilterNav().length, 0);

    const params = schoolDayHubHeroFetchParams(spec.slug)({
      audience_tag: "devushka",
      style_tag: "portret",
      occasion_tag: "svadba",
      object_tag: "s_mashinoy",
      doc_task_tag: null,
    });
    assert.equal(params.occasion_tag, spec.slug);
    assert.equal(params.audience_tag, null);
    assert.equal(params.style_tag, null);
    assert.equal(params.object_tag, null);
    assert.equal(params.sort, "new");
  }
});

test("teacher pattern catches Днем, Днём and a teacher portrait", () => {
  const teacher = findTagBySlug("occasion_tag", "den_uchitelya");
  const educator = findTagBySlug("occasion_tag", "den_vospitatelya");
  assert.ok(teacher);
  assert.ok(educator);
  assert.equal(teacher.urlPath, DEN_UCHITELYA_HUB_PATH);
  assert.equal(educator.urlPath, DEN_VOSPITATELYA_HUB_PATH);
  const teacherPatterns = patternsForTag("occasion_tag", "den_uchitelya");
  const educatorPatterns = patternsForTag("occasion_tag", "den_vospitatelya");
  assert.equal(teacherPatterns.some((pattern) => pattern.test("промт ко дню учителя")), true);
  assert.equal(teacherPatterns.some((pattern) => pattern.test("С Днем учителя!")), true);
  assert.equal(teacherPatterns.some((pattern) => pattern.test("С Днём Учителя!")), true);
  assert.equal(teacherPatterns.some((pattern) => pattern.test("smiling teacher holding school items")), true);
  assert.equal(teacherPatterns.some((pattern) => pattern.test("портрет учителя")), true);
  assert.equal(teacherPatterns.some((pattern) => pattern.test("атмосфера поучительная")), false);
  assert.equal(teacherPatterns.some((pattern) => pattern.test("фото воспитателя")), false);
  assert.equal(educatorPatterns.some((pattern) => pattern.test("промт на день воспитателя")), true);
  assert.equal(educatorPatterns.some((pattern) => pattern.test("С Днём воспитателя")), true);
  assert.equal(educatorPatterns.some((pattern) => pattern.test("фото воспитателя")), true);
  assert.equal(educatorPatterns.some((pattern) => pattern.test("воспитательный час")), false);
});

test("teacher hub slots stay on different lemmas", () => {
  const route = resolveUrlToTags(["promty-dlya-foto", "den-uchitelya"]);
  assert.ok(route);
  const raw = getSeoForRoute(route);
  const seo = applySchoolDayListingCount(raw, "den_uchitelya", 40);
  assert.equal(seo.h1, "Промты на день учителя");
  assert.equal(seo.metaTitle, "Промты на день учителя — 40+ готовых промтов на русском");
  assert.match(seo.intro, /промтов для фото ко дню учителя/i);
  assert.doesNotMatch(seo.intro, /ии-фото/i);
  assert.equal(seo.explorerTitle, "ИИ-фото на день учителя");
  assert.doesNotMatch(seo.explorerTitle ?? "", /промты на день учителя|открытк/i);
  assert.doesNotMatch(seo.explorerIntro ?? "", /ии-фото/i);
  assert.equal(seo.howToTitle, "Как использовать промт ко дню учителя");
  assert.doesNotMatch(seo.howToTitle ?? "", /ии-фото|открытк/i);
  assert.equal(
    seo.faqItems.filter((item) => /промт для открытки на день учителя/i.test(item.q)).length,
    1,
  );
  assert.equal(seo.popularLinks?.length ?? 0, 0);
  assert.equal(seo.seoTextBlocks?.length ?? 0, 0);
  assert.doesNotMatch(
    `${seo.h1} ${seo.intro} ${seo.explorerTitle} ${seo.explorerIntro} ${seo.howToTitle}`,
    /газет|календар|постер|видео/i,
  );

  const empty = applySchoolDayListingCount(raw, "den_uchitelya", 0);
  assert.equal(empty.metaTitle, "Промты на день учителя — готовые промты на русском");
  assert.match(empty.intro, /^Готовые промты для фото ко дню учителя/);
  assert.doesNotMatch(empty.metaTitle, /\{N\}|0\+/);
});

test("educator hub keeps фото in explorer and открытка in one FAQ", () => {
  const route = resolveUrlToTags(["promty-dlya-foto", "den-vospitatelya"]);
  assert.ok(route);
  const raw = getSeoForRoute(route);
  const seo = applySchoolDayListingCount(raw, "den_vospitatelya", 12);
  assert.equal(seo.h1, "Промты на день воспитателя");
  assert.equal(seo.metaTitle, "Промты на день воспитателя — 12+ готовых промтов на русском");
  assert.match(seo.intro, /промтов ко дню воспитателя/i);
  assert.doesNotMatch(seo.intro, /для фото|открытк/i);
  assert.equal(seo.explorerTitle, "Промт для фото на день воспитателя");
  assert.doesNotMatch(seo.explorerTitle ?? "", /промты на день воспитателя|открытк/i);
  assert.doesNotMatch(seo.explorerIntro ?? "", /для фото/i);
  assert.equal(seo.howToTitle, "Как использовать промт ко дню воспитателя");
  assert.doesNotMatch(seo.howToTitle ?? "", /для фото|открытк/i);
  assert.equal(
    seo.faqItems.filter((item) => /промт для открытки на день воспитателя/i.test(item.q)).length,
    1,
  );
  assert.equal(seo.popularLinks?.length ?? 0, 0);
  assert.equal(seo.seoTextBlocks?.length ?? 0, 0);
});
