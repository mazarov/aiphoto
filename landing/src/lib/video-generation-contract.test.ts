import assert from "node:assert/strict";
import test from "node:test";
import {
  isVideoAnimateFlagOn,
  isVideoAnimateUnlocked,
  isVideoGenerationResult,
  resolveVideoAspectRatio,
  resolveVideoModelId,
  resolveVideoResolution,
  validateVideoGenerationSource,
  videoSourceErrorMessage,
} from "./video-generation-contract";
import { assembleVideoMotionPrompt } from "./video-motion-prompt";

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
  assert.equal(
    resolveVideoModelId("unknown", ["gemini-omni-flash-preview"]),
    "gemini-omni-flash-preview"
  );
});

test("motion prompt locks the photo as the starting frame", () => {
  const assembled = assembleVideoMotionPrompt("Оживи изображение");
  assert.match(assembled, /\[# Sources @Image1\]/);
  assert.match(assembled, /starting frame/);
  assert.match(assembled, /IDENTITY LOCK/);
  assert.match(assembled, /Оживи изображение/);
  assert.doesNotMatch(assembled, /hook and payoff/);
  assert.doesNotMatch(assembled, /only subtle natural motion/);
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
