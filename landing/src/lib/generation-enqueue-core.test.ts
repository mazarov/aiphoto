import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeGenerationSurface,
  resolveGenerationSourceType,
  restoreSelectedPhotoIds,
} from "./generation-enqueue-core";

test("sourceType is text_only when initial gen has zero photos", () => {
  assert.equal(
    resolveGenerationSourceType({ hasParentGeneration: false, photoCount: 0 }),
    "text_only"
  );
});

test("sourceType is user_photos when initial gen has photos", () => {
  assert.equal(
    resolveGenerationSourceType({ hasParentGeneration: false, photoCount: 1 }),
    "user_photos"
  );
});

test("sourceType is generation_result when parent is set, even with zero photos", () => {
  assert.equal(
    resolveGenerationSourceType({ hasParentGeneration: true, photoCount: 0 }),
    "generation_result"
  );
});

test("generationSurface is a funnel label, not a photo capability switch", () => {
  assert.equal(normalizeGenerationSurface("seo_page"), "seo_page");
  assert.equal(normalizeGenerationSurface("prompt_card"), "prompt_card");
  assert.equal(normalizeGenerationSurface(undefined), "prompt_card");
  assert.equal(normalizeGenerationSurface("admin"), "prompt_card");
});

test("explicit empty stored photo selection stays empty", () => {
  assert.deepEqual(
    restoreSelectedPhotoIds({
      availablePhotoIds: ["a", "b"],
      storedPhotoIds: [],
    }),
    []
  );
});

test("missing photo prefs default to the newest library photo", () => {
  assert.deepEqual(
    restoreSelectedPhotoIds({
      availablePhotoIds: ["newest", "older"],
      storedPhotoIds: undefined,
    }),
    ["newest"]
  );
});

test("stored photo ids that left the library are dropped", () => {
  assert.deepEqual(
    restoreSelectedPhotoIds({
      availablePhotoIds: ["b"],
      storedPhotoIds: ["gone", "b"],
    }),
    ["b"]
  );
});

test("all stored photos gone falls back to the newest library photo", () => {
  assert.deepEqual(
    restoreSelectedPhotoIds({
      availablePhotoIds: ["newest", "older"],
      storedPhotoIds: ["gone"],
    }),
    ["newest"]
  );
});
