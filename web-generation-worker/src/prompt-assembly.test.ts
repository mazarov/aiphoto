import assert from "node:assert/strict";
import test from "node:test";
import {
  assembleLandingCardEditPrompt,
  assembleLandingCardFinalPrompt,
  assembleTextToImageFinalPrompt,
  assembleVibeFinalPrompt,
} from "../../landing/src/lib/image-generation-prompt";

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

test("dual-image vibe prompt appends grooming recency tail only when requested", () => {
  const body =
    "Studio portrait\nHair styling (transfer from reference): glossy waves.";
  const dual = assembleVibeFinalPrompt(body, true);
  const single = assembleVibeFinalPrompt(body, false);
  assert.match(dual, /IMAGE A = style reference/);
  assert.match(dual, /LAST — must show/);
  assert.doesNotMatch(single, /LAST — must show/);
});
