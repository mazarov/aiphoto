import assert from "node:assert/strict";
import test from "node:test";
import {
  assembleLandingCardFinalPrompt,
  assembleVibeFinalPrompt,
} from "../../landing/src/lib/image-generation-prompt";

test("card prompt appends identity and wardrobe rules after user text", () => {
  const prompt = assembleLandingCardFinalPrompt("A red evening dress");
  assert.ok(prompt.startsWith("A red evening dress"));
  assert.match(prompt, /CRITICAL RULES/);
  assert.match(prompt, /fully replace clothing/);
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
