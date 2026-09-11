import assert from "node:assert/strict";
import { test } from "node:test";
import {
  COMPOSE_PICK_IMAGE_MODEL_CTA,
  COMPOSE_RU_TEXT_BADGE,
  COMPOSE_RU_TEXT_BADGE_HINT,
  composeImageModelRuTextBadge,
  composeNeedsImageModelPick,
  composeShouldAutoOpenModelSheet,
  hasCompletedImageGenerationFromList,
  resolveComposerImageModel,
} from "./compose-image-model";

const IMAGE_IDS = [
  "gemini-2.5-flash-image",
  "gemini-3-pro-image-preview",
  "gemini-3.1-flash-image-preview",
];

test("composeNeedsImageModelPick only on image compose without a model", () => {
  assert.equal(
    composeNeedsImageModelPick({ composeMode: "image", modelId: "" }),
    true,
  );
  assert.equal(
    composeNeedsImageModelPick({ composeMode: "image", modelId: "   " }),
    true,
  );
  assert.equal(
    composeNeedsImageModelPick({
      composeMode: "image",
      modelId: "gemini-3-pro-image-preview",
    }),
    false,
  );
  assert.equal(
    composeNeedsImageModelPick({ composeMode: "video", modelId: "" }),
    false,
  );
  assert.equal(
    composeNeedsImageModelPick({ composeMode: "photoshoot", modelId: "" }),
    false,
  );
});

test("composeShouldAutoOpenModelSheet waits behind the example sheet", () => {
  assert.equal(
    composeShouldAutoOpenModelSheet({
      composeMode: "image",
      modelId: "",
      exampleSheetWillOpen: true,
    }),
    false,
  );
  assert.equal(
    composeShouldAutoOpenModelSheet({
      composeMode: "image",
      modelId: "",
      exampleSheetWillOpen: false,
    }),
    true,
  );
  assert.equal(
    composeShouldAutoOpenModelSheet({
      composeMode: "image",
      modelId: "gemini-2.5-flash-image",
    }),
    false,
  );
});

test("completed image list ignores video and non-completed jobs", () => {
  assert.equal(hasCompletedImageGenerationFromList(null), false);
  assert.equal(hasCompletedImageGenerationFromList([]), false);
  assert.equal(
    hasCompletedImageGenerationFromList([
      { status: "failed", modality: "image" },
      { status: "completed", modality: "video" },
    ]),
    false,
  );
  assert.equal(
    hasCompletedImageGenerationFromList([
      { status: "completed", modality: "image" },
    ]),
    true,
  );
  assert.equal(
    hasCompletedImageGenerationFromList([
      { status: "completed", modality: null },
    ]),
    true,
  );
});

test("resolveComposerImageModel does not default Flash before a photo job", () => {
  assert.equal(
    resolveComposerImageModel({
      storedModel: "gemini-2.5-flash-image",
      imageModelIds: IMAGE_IDS,
      hasCompletedImageGeneration: false,
      defaultModel: "gemini-2.5-flash-image",
    }),
    "",
  );
  assert.equal(
    resolveComposerImageModel({
      storedModel: "gemini-3-pro-image-preview",
      imageModelIds: IMAGE_IDS,
      hasCompletedImageGeneration: true,
      defaultModel: "gemini-2.5-flash-image",
    }),
    "gemini-3-pro-image-preview",
  );
  assert.equal(
    resolveComposerImageModel({
      storedModel: "gemini-2.5-flash-image",
      imageModelIds: IMAGE_IDS,
      hasCompletedImageGeneration: false,
      explicitModelId: "gemini-3-pro-image-preview",
      defaultModel: "gemini-2.5-flash-image",
    }),
    "gemini-3-pro-image-preview",
  );
  assert.equal(
    resolveComposerImageModel({
      storedModel: "retired",
      imageModelIds: IMAGE_IDS,
      hasCompletedImageGeneration: true,
      defaultModel: "gemini-2.5-flash-image",
    }),
    "gemini-2.5-flash-image",
  );
});

test("pick-model CTA copy", () => {
  assert.equal(COMPOSE_PICK_IMAGE_MODEL_CTA, "Выбрать модель");
});

test("Russian-text badge is only on Nano Banana PRO", () => {
  assert.equal(COMPOSE_RU_TEXT_BADGE, "Русский текст");
  assert.equal(
    COMPOSE_RU_TEXT_BADGE_HINT,
    "Лучше читает русский текст на кадре",
  );
  assert.equal(
    composeImageModelRuTextBadge("gemini-3-pro-image-preview"),
    "Русский текст",
  );
  assert.equal(composeImageModelRuTextBadge("gemini-2.5-flash-image"), null);
  assert.equal(
    composeImageModelRuTextBadge("gemini-3.1-flash-image-preview"),
    null,
  );
  assert.equal(composeImageModelRuTextBadge("grok-imagine-image-2.0"), null);
});
