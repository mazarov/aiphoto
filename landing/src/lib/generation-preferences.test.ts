import assert from "node:assert/strict";
import test from "node:test";
import {
  FALLBACK_COMPOSER_DEFAULTS,
  parseStoredGenerationPreferences,
  pickFresherPreferences,
  resolveComposerPreferences,
} from "./generation-preferences";

const IMAGE_IDS = [
  "gemini-2.5-flash-image",
  "gemini-3.1-flash-image-preview",
  "grok-imagine-image-2.0",
];
const VIDEO_IDS = [
  "gemini-omni-flash-preview",
  "grok-imagine-video-1.5",
  "veo-3.1-lite-generate-preview",
];

function stored(
  override: Partial<ReturnType<typeof parseStoredGenerationPreferences>> = {}
) {
  return {
    model: "gemini-3.1-flash-image-preview",
    aspectRatio: "3:4",
    imageSize: "2K",
    selectedPhotoIds: ["p2", "p1"],
    videoModel: "grok-imagine-video-1.5",
    videoAspectRatio: "16:9",
    videoDurationSeconds: 8,
    updatedAt: "2026-08-22T10:00:00.000Z",
    ...override,
  };
}

test("resolve restores last photos, image model, and video settings", () => {
  const resolved = resolveComposerPreferences({
    stored: stored(),
    imageModelIds: IMAGE_IDS,
    videoModelIds: VIDEO_IDS,
    availablePhotoIds: ["p1", "p2", "p3"],
  });
  assert.equal(resolved.model, "gemini-3.1-flash-image-preview");
  assert.equal(resolved.aspectRatio, "3:4");
  assert.equal(resolved.imageSize, "2K");
  assert.deepEqual(resolved.selectedPhotoIds, ["p2", "p1"]);
  assert.equal(resolved.videoModel, "grok-imagine-video-1.5");
  assert.equal(resolved.videoAspectRatio, "16:9");
  assert.equal(resolved.videoDurationSeconds, 8);
});

test("missing prefs use product defaults and the newest photo", () => {
  const resolved = resolveComposerPreferences({
    stored: null,
    imageModelIds: IMAGE_IDS,
    videoModelIds: VIDEO_IDS,
    availablePhotoIds: ["newest", "older"],
  });
  assert.equal(resolved.model, FALLBACK_COMPOSER_DEFAULTS.model);
  assert.deepEqual(resolved.selectedPhotoIds, ["newest"]);
  assert.equal(resolved.videoModel, FALLBACK_COMPOSER_DEFAULTS.videoModel);
});

test("explicit empty photo selection stays empty", () => {
  const resolved = resolveComposerPreferences({
    stored: stored({ selectedPhotoIds: [] }),
    imageModelIds: IMAGE_IDS,
    videoModelIds: VIDEO_IDS,
    availablePhotoIds: ["newest", "older"],
  });
  assert.deepEqual(resolved.selectedPhotoIds, []);
});

test("disabled stored models fall back without dropping photos", () => {
  const resolved = resolveComposerPreferences({
    stored: stored({
      model: "retired-image",
      videoModel: "retired-video",
    }),
    imageModelIds: IMAGE_IDS,
    videoModelIds: VIDEO_IDS,
    availablePhotoIds: ["p1", "p2"],
  });
  assert.equal(resolved.model, FALLBACK_COMPOSER_DEFAULTS.model);
  assert.equal(resolved.videoModel, FALLBACK_COMPOSER_DEFAULTS.videoModel);
  assert.deepEqual(resolved.selectedPhotoIds, ["p2", "p1"]);
});

test("newer cache wins over stale server prefs", () => {
  const server = stored({
    selectedPhotoIds: ["old"],
    updatedAt: "2026-08-22T10:00:00.000Z",
  });
  const cached = stored({
    selectedPhotoIds: ["p1", "p2"],
    updatedAt: "2026-08-22T10:00:01.000Z",
  });
  const picked = pickFresherPreferences(server, cached);
  assert.deepEqual(picked?.selectedPhotoIds, ["p1", "p2"]);
});

test("parse ignores a payload without an image model", () => {
  assert.equal(parseStoredGenerationPreferences({ selectedPhotoIds: ["p1"] }), null);
});
