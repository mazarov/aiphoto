/**
 * Seedream 4.5 image prompts. No Gemini [# Sources] / IMAGE A/B tags.
 * Identity rules match Grok; clamp to OpenRouter/Seedream 4000-char prompt limit.
 */

import {
  assembleGrokCameraOrbitPrompt,
  assembleGrokImageEditPrompt,
  assembleGrokImageToImagePrompt,
  assembleGrokPhotoshootSheetPrompt,
  assembleGrokTextToImagePrompt,
  assembleGrokVibePrompt,
} from "./grok-image-prompt";

export const SEEDREAM_PROMPT_MAX_CHARS = 4000;

export function clampSeedreamPrompt(prompt: string): string {
  const text = String(prompt ?? "");
  return text.length <= SEEDREAM_PROMPT_MAX_CHARS
    ? text
    : text.slice(0, SEEDREAM_PROMPT_MAX_CHARS);
}

export function assembleSeedreamTextToImagePrompt(rawPrompt: string): string {
  return clampSeedreamPrompt(assembleGrokTextToImagePrompt(rawPrompt));
}

export function assembleSeedreamImageToImagePrompt(rawPrompt: string): string {
  return clampSeedreamPrompt(assembleGrokImageToImagePrompt(rawPrompt));
}

export function assembleSeedreamImageEditPrompt(editInstruction: string): string {
  return clampSeedreamPrompt(assembleGrokImageEditPrompt(editInstruction));
}

export function assembleSeedreamCameraOrbitPrompt(editInstruction: string): string {
  return clampSeedreamPrompt(assembleGrokCameraOrbitPrompt(editInstruction));
}

export function assembleSeedreamPhotoshootSheetPrompt(editInstruction: string): string {
  return clampSeedreamPrompt(assembleGrokPhotoshootSheetPrompt(editInstruction));
}

export function assembleSeedreamVibePrompt(
  rawExpandedPrompt: string,
  hasStyleReference: boolean,
): string {
  return clampSeedreamPrompt(assembleGrokVibePrompt(rawExpandedPrompt, hasStyleReference));
}
