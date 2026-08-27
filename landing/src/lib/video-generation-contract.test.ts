import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateVideoCreditCost,
  isVideoAnimateFlagOn,
  isVideoAnimateUnlocked,
  isVideoGenerationResult,
  normalizeVideoDurationSeconds,
  resolveVideoAspectRatio,
  resolveVideoModelId,
  resolveVideoResolution,
  validateVideoGenerationSource,
  videoDurationExtraCredits,
  videoSourceErrorMessage,
} from "./video-generation-contract";
import {
  assembleGrokVideoMotionPrompt,
  assembleSeedanceVideoMotionPrompt,
  assembleVeoVideoMotionPrompt,
  assembleVideoMotionPrompt,
} from "./video-motion-prompt";
import {
  DEFAULT_VIDEO_MODEL,
  SEEDANCE_25_VIDEO_MODEL,
  isGrokVideoModel,
  isSeedanceVideoModel,
  isVeoLiteVideoModel,
  videoDurationOptionsForModel,
} from "./generation/image-options";

test("video source rejects text-only and mixed parent+photos", () => {
  assert.equal(
    validateVideoGenerationSource({ hasParentGeneration: false, photoCount: 0 }),
    "video_text_only_forbidden"
  );
  assert.equal(
    validateVideoGenerationSource({ hasParentGeneration: true, photoCount: 1 }),
    "video_source_conflict"
  );
  assert.equal(
    validateVideoGenerationSource({ hasParentGeneration: false, photoCount: 2 }),
    "video_source_required"
  );
});

test("video source accepts parent image or one user photo", () => {
  assert.equal(
    validateVideoGenerationSource({
      hasParentGeneration: true,
      photoCount: 0,
      parentModality: "image",
    }),
    null
  );
  assert.equal(
    validateVideoGenerationSource({ hasParentGeneration: false, photoCount: 1 }),
    null
  );
});

test("video source rejects edit instruction and video parent", () => {
  assert.equal(
    validateVideoGenerationSource({
      hasParentGeneration: true,
      photoCount: 0,
      editInstruction: "убери шарф",
    }),
    "video_edit_forbidden"
  );
  assert.equal(
    validateVideoGenerationSource({
      hasParentGeneration: true,
      photoCount: 0,
      parentModality: "video",
    }),
    "video_parent_must_be_image"
  );
  assert.match(videoSourceErrorMessage("video_parent_must_be_image"), /фото/);
});

test("video option resolvers fall back to v1 defaults", () => {
  assert.equal(resolveVideoAspectRatio("3:4"), "9:16");
  assert.equal(resolveVideoAspectRatio("16:9"), "16:9");
  assert.equal(resolveVideoResolution("4K"), "720p");
  assert.equal(normalizeVideoDurationSeconds(8), 8);
  assert.equal(normalizeVideoDurationSeconds("10"), 10);
  assert.equal(normalizeVideoDurationSeconds(5), 4);
  assert.equal(
    resolveVideoModelId("unknown", ["gemini-omni-flash-preview"]),
    "gemini-omni-flash-preview"
  );
  assert.equal(
    resolveVideoModelId("unknown", [
      "gemini-omni-flash-preview",
      "grok-imagine-video-1.5",
    ]),
    "gemini-omni-flash-preview"
  );
  assert.equal(
    resolveVideoModelId("unknown", [
      "gemini-omni-flash-preview",
      "grok-imagine-video-1.5",
      "veo-3.1-lite-generate-preview",
    ]),
    "veo-3.1-lite-generate-preview"
  );
  assert.equal(
    resolveVideoModelId("gemini-omni-flash-preview", [
      "grok-imagine-video-1.5",
      "gemini-omni-flash-preview",
    ]),
    "gemini-omni-flash-preview"
  );
  assert.equal(DEFAULT_VIDEO_MODEL, "veo-3.1-lite-generate-preview");
  assert.equal(isGrokVideoModel("grok-imagine-video-1.5"), true);
  assert.equal(isGrokVideoModel("gemini-omni-flash-preview"), false);
  assert.equal(isVeoLiteVideoModel("veo-3.1-lite-generate-preview"), true);
  assert.equal(isVeoLiteVideoModel("gemini-omni-flash-preview"), false);
  assert.equal(isSeedanceVideoModel(SEEDANCE_25_VIDEO_MODEL), true);
  assert.equal(isSeedanceVideoModel("seedream-5.0-pro"), false);
  assert.deepEqual(
    videoDurationOptionsForModel("veo-3.1-lite-generate-preview").map((item) => item.value),
    [4, 6, 8]
  );
  assert.equal(normalizeVideoDurationSeconds(10, "veo-3.1-lite-generate-preview"), 8);
  assert.equal(normalizeVideoDurationSeconds(6, "veo-3.1-lite-generate-preview"), 6);
});

test("video credit cost adds duration extras on top of base 30", () => {
  assert.equal(videoDurationExtraCredits(4), 0);
  assert.equal(videoDurationExtraCredits(6), 10);
  assert.equal(videoDurationExtraCredits(8), 20);
  assert.equal(videoDurationExtraCredits(10), 30);
  assert.equal(calculateVideoCreditCost(30, 4), 30);
  assert.equal(calculateVideoCreditCost(30, 6), 40);
  assert.equal(calculateVideoCreditCost(30, 8), 50);
  assert.equal(calculateVideoCreditCost(30, 10), 60);
  assert.equal(calculateVideoCreditCost(30, 7), 30);
  assert.equal(calculateVideoCreditCost(-1, 10), 30);
  assert.equal(calculateVideoCreditCost(15, 4, "veo-3.1-lite-generate-preview"), 15);
  assert.equal(calculateVideoCreditCost(15, 8, "veo-3.1-lite-generate-preview"), 35);
  assert.equal(calculateVideoCreditCost(15, 10, "veo-3.1-lite-generate-preview"), 35);
  assert.equal(calculateVideoCreditCost(96, 4, SEEDANCE_25_VIDEO_MODEL), 96);
  assert.equal(calculateVideoCreditCost(96, 6, SEEDANCE_25_VIDEO_MODEL), 144);
  assert.equal(calculateVideoCreditCost(96, 8, SEEDANCE_25_VIDEO_MODEL), 192);
  assert.equal(calculateVideoCreditCost(96, 10, SEEDANCE_25_VIDEO_MODEL), 240);
  assert.equal(calculateVideoCreditCost(1, 5, SEEDANCE_25_VIDEO_MODEL), 96);
  assert.equal(videoDurationExtraCredits(4, SEEDANCE_25_VIDEO_MODEL), 0);
  assert.equal(videoDurationExtraCredits(6, SEEDANCE_25_VIDEO_MODEL), 48);
  assert.equal(videoDurationExtraCredits(8, SEEDANCE_25_VIDEO_MODEL), 96);
  assert.equal(videoDurationExtraCredits(10, SEEDANCE_25_VIDEO_MODEL), 144);
});

test("motion prompt locks the photo as the starting frame", () => {
  const assembled = assembleVideoMotionPrompt("Оживи изображение");
  assert.match(assembled, /\[# Sources @Image1\]/);
  assert.match(assembled, /starting frame/);
  assert.match(assembled, /IDENTITY LOCK/);
  assert.match(assembled, /Оживи изображение/);
  assert.doesNotMatch(assembled, /hook and payoff/);
  assert.doesNotMatch(assembled, /only subtle natural motion/);
  assert.doesNotMatch(assembled, /@Image2|References/);
});

test("Grok motion prompt has identity lock without Gemini source tags", () => {
  const assembled = assembleGrokVideoMotionPrompt("Оживи изображение");
  assert.doesNotMatch(assembled, /\[# Sources @Image1\]/);
  assert.doesNotMatch(assembled, /@Image2|References/);
  assert.match(assembled, /starting frame/);
  assert.match(assembled, /Identity lock/i);
  assert.match(assembled, /Оживи изображение/);
});

test("Seedance motion prompt matches plain identity lock", () => {
  const assembled = assembleSeedanceVideoMotionPrompt("Оживи изображение");
  assert.doesNotMatch(assembled, /\[# Sources @Image1\]/);
  assert.match(assembled, /starting frame/);
  assert.match(assembled, /Оживи изображение/);
});

test("Veo Lite motion prompt matches plain identity lock", () => {
  const assembled = assembleVeoVideoMotionPrompt("Оживи изображение");
  assert.doesNotMatch(assembled, /\[# Sources @Image1\]/);
  assert.match(assembled, /starting frame/);
  assert.match(assembled, /Оживи изображение/);
});

test("video result detection uses modality, mime, or mp4 path", () => {
  assert.equal(isVideoGenerationResult({ modality: "video" }), true);
  assert.equal(isVideoGenerationResult({ mimeType: "video/mp4" }), true);
  assert.equal(
    isVideoGenerationResult({
      url: "https://cdn.example/user/job/lease.mp4?token=1",
    }),
    true
  );
  assert.equal(isVideoGenerationResult({ url: "https://cdn.example/job.jpg" }), false);
});

test("video animate flag is off unless explicitly enabled", () => {
  assert.equal(isVideoAnimateFlagOn(undefined), false);
  assert.equal(isVideoAnimateFlagOn("false"), false);
  assert.equal(isVideoAnimateFlagOn("true"), true);
  assert.equal(isVideoAnimateUnlocked("true"), true);
  assert.equal(
    isVideoAnimateUnlocked("false", "someone@example.com"),
    process.env.NODE_ENV === "development"
  );
  assert.equal(isVideoAnimateUnlocked("false", "azarov.maxim@gmail.com"), true);
});
