import assert from "node:assert/strict";
import test from "node:test";
import { buildCanonicalPath, resolveUrlToTags } from "./route-resolver";
import { findTagBySlug } from "./tag-registry";

test("birthday hub still resolves as L1 on the old path", () => {
  const route = resolveUrlToTags(["sobytiya", "den-rozhdeniya"]);
  assert.ok(route);
  assert.equal(route.level, 1);
  assert.equal(route.canonicalPath, "/sobytiya/den-rozhdeniya");
  assert.equal(route.primaryTag.slug, "den_rozhdeniya");
});

test("audience-first birthday L2 canonicalizes to hub child", () => {
  const route = resolveUrlToTags(["promty-dlya-foto-devushki", "den-rozhdeniya"]);
  assert.ok(route);
  assert.equal(route.canonicalPath, "/sobytiya/den-rozhdeniya/devushki");
  assert.equal(route.rpcParams.audience_tag, "devushka");
  assert.equal(route.rpcParams.occasion_tag, "den_rozhdeniya");
});

test("audience-first birthday L3 canonicalizes to hub child", () => {
  const route = resolveUrlToTags([
    "promty-dlya-foto-devushki",
    "den-rozhdeniya",
    "s-tortom",
  ]);
  assert.ok(route);
  assert.equal(route.level, 3);
  assert.equal(
    route.canonicalPath,
    "/sobytiya/den-rozhdeniya/devushki/s-tortom",
  );
});

test("short birthday children resolve and stay occasion-first", () => {
  const route = resolveUrlToTags(["sobytiya", "den-rozhdeniya", "deti"]);
  assert.ok(route);
  assert.equal(route.level, 2);
  assert.equal(route.canonicalPath, "/sobytiya/den-rozhdeniya/deti");
  assert.equal(route.parentPath, "/sobytiya/den-rozhdeniya");
  assert.equal(route.rpcParams.audience_tag, "detskie");
});

test("existing object child under hub keeps its URL", () => {
  const route = resolveUrlToTags(["sobytiya", "den-rozhdeniya", "s-tortom"]);
  assert.ok(route);
  assert.equal(route.canonicalPath, "/sobytiya/den-rozhdeniya/s-tortom");
  assert.equal(route.rpcParams.object_tag, "s_tortom");
});

test("non-birthday combos stay audience-first", () => {
  const girl = findTagBySlug("audience_tag", "devushka");
  const flowers = findTagBySlug("object_tag", "s_cvetami");
  assert.ok(girl && flowers);
  assert.equal(
    buildCanonicalPath([girl, flowers]),
    "/promty-dlya-foto-devushki/s-cvetami",
  );
});
