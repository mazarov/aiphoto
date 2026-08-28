import assert from "node:assert/strict";
import test from "node:test";
import {
  assembleGrokImageEditPrompt,
  assembleGrokImageToImagePrompt,
  assembleGrokTextToImagePrompt,
  assembleGrokVibePrompt,
} from "../../landing/src/lib/grok-image-prompt";

test("Grok image prompts have no Gemini source tags", () => {
  const prompts = [
    assembleGrokTextToImagePrompt("a lake"),
    assembleGrokImageToImagePrompt("studio portrait"),
    assembleGrokImageEditPrompt("remove the hat"),
    assembleGrokVibePrompt("night market", true),
  ];
  for (const prompt of prompts) {
    assert.doesNotMatch(prompt, /\[# Sources/);
    assert.doesNotMatch(prompt, /IMAGE A/);
    assert.doesNotMatch(prompt, /IMAGE B/);
  }
  assert.match(assembleGrokImageEditPrompt("remove the hat"), /EDIT REQUEST/);
  assert.match(
    assembleGrokImageEditPrompt("PHOTOSHOOT (HIGHEST PRIORITY)\nPanel 1: step."),
    /contact sheet/,
  );
});
