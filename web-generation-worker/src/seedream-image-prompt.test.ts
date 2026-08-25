import assert from "node:assert/strict";
import test from "node:test";
import {
  assembleSeedreamImageEditPrompt,
  assembleSeedreamImageToImagePrompt,
  assembleSeedreamTextToImagePrompt,
  assembleSeedreamVibePrompt,
  clampSeedreamPrompt,
} from "../../landing/src/lib/seedream-image-prompt";

test("Seedream image prompts have no Gemini source tags and clamp at 4000", () => {
  const prompts = [
    assembleSeedreamTextToImagePrompt("a lake"),
    assembleSeedreamImageToImagePrompt("studio portrait"),
    assembleSeedreamImageEditPrompt("remove the hat"),
    assembleSeedreamVibePrompt("night market", true),
  ];
  for (const prompt of prompts) {
    assert.doesNotMatch(prompt, /\[# Sources/);
    assert.doesNotMatch(prompt, /IMAGE A/);
    assert.doesNotMatch(prompt, /IMAGE B/);
  }
  assert.equal(clampSeedreamPrompt("x".repeat(4001)).length, 4000);
});
