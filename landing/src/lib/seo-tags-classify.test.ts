import assert from "node:assert/strict";
import { test } from "node:test";
import {
  catalogPathsForSeoTags,
  unionKnownRegistryTags,
} from "./seo-tags-classify";

test("model tags keep an explicit teacher-day match", () => {
  const merged = unionKnownRegistryTags(
    { occasion_tag: ["den_rozhdeniya"], audience_tag: ["devushka"] },
    "Открытка",
    ["Яркая композиция, посвящённая Днём учителя, портрет у доски"],
  );
  assert.equal(merged.changed, true);
  assert.deepEqual(merged.seo_tags.occasion_tag, ["den_rozhdeniya", "den_uchitelya"]);
  assert.deepEqual(merged.seo_tags.audience_tag, ["devushka"]);
  assert.ok(catalogPathsForSeoTags(merged.seo_tags).includes("/promty-dlya-foto/den-uchitelya"));
});

test("repeat merge does not rewrite tags that are already stored", () => {
  const stored = {
    occasion_tag: ["den_uchitelya"],
    labels: { ru: ["Промт для фото день учителя"], en: [] },
  };
  const merged = unionKnownRegistryTags(stored, null, ["учитель у доски"]);
  assert.equal(merged.changed, false);
  assert.deepEqual(merged.seo_tags.occasion_tag, ["den_uchitelya"]);
  assert.deepEqual(merged.seo_tags.labels.ru, ["Промт для фото день учителя"]);
});

test("поучительная is not teacher day and воспитательный is not educator day", () => {
  const teacher = unionKnownRegistryTags({}, null, ["поучительная история в кадре"]);
  const educator = unionKnownRegistryTags({}, null, ["воспитательный момент в саду"]);
  assert.deepEqual(teacher.seo_tags.occasion_tag, []);
  assert.deepEqual(educator.seo_tags.occasion_tag, []);
});

test("educator portrait and an English teacher both keep their occasion slug", () => {
  const educator = unionKnownRegistryTags(
    {},
    null,
    ["Иллюстрация радостной воспитательницы в окружении детей"],
  );
  const teacher = unionKnownRegistryTags({}, "Teacher portrait", []);
  assert.deepEqual(educator.seo_tags.occasion_tag, ["den_vospitatelya"]);
  assert.deepEqual(teacher.seo_tags.occasion_tag, ["den_uchitelya"]);
  assert.ok(
    catalogPathsForSeoTags(educator.seo_tags).includes("/promty-dlya-foto/den-vospitatelya"),
  );
});
