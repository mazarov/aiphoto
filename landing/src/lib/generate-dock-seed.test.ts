import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_GENERATE_DOCK_SEED,
  isResumeComposeSeed,
  shouldAttachLibraryPhotos,
  shouldHydrateLastDockResult,
  type GenerateDockSeed,
} from "./generate-dock-seed";

function seed(
  overrides: Partial<GenerateDockSeed> = {}
): GenerateDockSeed {
  return { ...DEFAULT_GENERATE_DOCK_SEED, ...overrides };
}

test("isResumeComposeSeed is true only for default blank resume", () => {
  assert.equal(isResumeComposeSeed(DEFAULT_GENERATE_DOCK_SEED), true);
  assert.equal(isResumeComposeSeed(seed({ promptText: "   " })), true);
});

test("isResumeComposeSeed is false for photo_prompt with empty prompt", () => {
  assert.equal(
    isResumeComposeSeed(seed({ intent: "photo_prompt" })),
    false
  );
});

test("isResumeComposeSeed is false for text intent, card, or filled prompt", () => {
  assert.equal(isResumeComposeSeed(seed({ intent: "text" })), false);
  assert.equal(
    isResumeComposeSeed(seed({ promptText: "a ready prompt" })),
    false
  );
  assert.equal(
    isResumeComposeSeed(
      seed({ source: "card", cardId: "c1", promptText: "scene" })
    ),
    false
  );
});

test("shouldHydrateLastDockResult is true only for blank resume", () => {
  assert.equal(shouldHydrateLastDockResult(DEFAULT_GENERATE_DOCK_SEED), true);
  assert.equal(shouldHydrateLastDockResult(seed({ intent: "text" })), false);
  assert.equal(
    shouldHydrateLastDockResult(seed({ intent: "photo_prompt" })),
    false
  );
  assert.equal(
    shouldHydrateLastDockResult(
      seed({ source: "card", cardId: "c1", intent: "resume" })
    ),
    false
  );
});

test("shouldAttachLibraryPhotos is false only for photo_prompt compose", () => {
  assert.equal(shouldAttachLibraryPhotos(DEFAULT_GENERATE_DOCK_SEED), true);
  assert.equal(shouldAttachLibraryPhotos(seed({ intent: "text" })), true);
  assert.equal(
    shouldAttachLibraryPhotos(seed({ intent: "photo_prompt" })),
    false
  );
  assert.equal(
    shouldAttachLibraryPhotos(
      seed({ intent: "photo_prompt", promptText: "a ready prompt from analyze" })
    ),
    false
  );
});
