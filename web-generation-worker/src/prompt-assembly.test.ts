import assert from "node:assert/strict";
import test from "node:test";
import {
  assembleCameraOrbitEditPrompt,
  assembleLandingCardEditPrompt,
  assembleLandingCardFinalPrompt,
  assembleTextToImageFinalPrompt,
  assembleVibeFinalPrompt,
} from "../../landing/src/lib/image-generation-prompt";
import {
  assembleGrokCameraOrbitPrompt,
  assembleGrokImageEditPrompt,
} from "../../landing/src/lib/grok-image-prompt";

test("card prompt appends identity and wardrobe rules after user text", () => {
  const prompt = assembleLandingCardFinalPrompt("A red evening dress");
  assert.ok(prompt.startsWith("A red evening dress"));
  assert.match(prompt, /CRITICAL RULES/);
  assert.match(prompt, /fully replace clothing/);
});

test("text-to-image prompt does not append identity preservation rules", () => {
  const prompt = assembleTextToImageFinalPrompt(
    "A glass greenhouse in a pine forest"
  );
  assert.match(prompt, /TEXT-TO-IMAGE RULES/);
  assert.match(prompt, /no input or reference image/i);
  assert.doesNotMatch(prompt, /same person/);
  assert.doesNotMatch(prompt, /fully replace clothing/);
});

test("local edit prompt contains only delta and preservation rules", () => {
  const prompt = assembleLandingCardEditPrompt("Remove the scarf");
  assert.match(prompt, /EDIT REQUEST \(HIGHEST PRIORITY\)/);
  assert.match(prompt, /Remove the scarf/);
  assert.match(prompt, /Keep everything else exactly the same/);
  assert.match(prompt, /aspect ratio/);
  assert.doesNotMatch(prompt, /fully replace clothing/);
});

test("local-edit assembler refuses to wrap a camera-orbit instruction", () => {
  const instruction =
    "CAMERA ORBIT (HIGHEST PRIORITY)\nAzimuth: 30 degrees (left of the subject).";
  const gemini = assembleLandingCardEditPrompt(instruction);
  const grok = assembleGrokImageEditPrompt(instruction);
  assert.match(gemini, /CAMERA ORBIT RULES/);
  assert.doesNotMatch(gemini, /LOCAL IMAGE EDIT RULES/);
  assert.doesNotMatch(gemini, /Keep everything else exactly the same/);
  assert.match(grok, /you FAILED/);
  assert.doesNotMatch(grok, /Keep everything else the same[\s\S]*camera/);
});

test("camera orbit prompt does not reuse local-edit keep-camera rules", () => {
  const prompt = assembleCameraOrbitEditPrompt(
    "CAMERA ORBIT (HIGHEST PRIORITY)\nAzimuth: 30 degrees",
  );
  assert.match(prompt, /CAMERA ORBIT RULES/);
  assert.match(prompt, /Do not turn the head/);
  assert.doesNotMatch(prompt, /LOCAL IMAGE EDIT RULES/);
  assert.doesNotMatch(prompt, /Keep everything else exactly the same/);
  assert.doesNotMatch(prompt, /camera angle/);
});

test("grok camera orbit prompt does not keep the source camera", () => {
  const orbit = assembleGrokCameraOrbitPrompt("Azimuth: 30 degrees");
  const local = assembleGrokImageEditPrompt("Add glasses");
  assert.match(orbit, /camera move/i);
  assert.doesNotMatch(orbit, /Keep everything else the same[\s\S]*camera/);
  assert.match(local, /crop, and camera/);
});

test("dual-image vibe prompt appends grooming recency tail only when requested", () => {
  const body =
    "Studio portrait\nHair styling (transfer from reference): glossy waves.";
  const dual = assembleVibeFinalPrompt(body, true);
  const single = assembleVibeFinalPrompt(body, false);
  assert.match(dual, /IMAGE A = style reference/);
  assert.match(dual, /LAST — must show/);
  assert.doesNotMatch(single, /LAST — must show/);
});
