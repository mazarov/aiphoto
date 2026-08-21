/**
 * Grok Imagine image prompts. No Gemini [# Sources] / IMAGE A/B tags.
 */

const IDENTITY_RULES = [
  "The provided photo(s) show the SUBJECT (a real person).",
  "Output exactly one new photorealistic photograph of that same person following the text description.",
  "Preserve identity: face structure, features, skin tone, eye color, body proportions, natural hair color.",
  "Do not swap in a different face or body.",
  "Unless the text explicitly says to keep the outfit, replace clothing to match the prompt.",
  "The result must look naturally photographed, not pasted.",
].join("\n");

const TEXT_ONLY_RULES = [
  "There is no input photo. Create exactly one new image from the text description.",
  "Do not invent a requirement to preserve an existing person's identity.",
  "Follow the requested subject, scene, medium, style, light, composition, and camera.",
].join("\n");

const EDIT_RULES = [
  "The provided image is the current result to edit, not a loose style reference.",
  "Apply only the requested local change. Keep everything else the same: identity, pose, wardrobe outside the edit, background, lighting, crop, and camera.",
  "Do not redesign or regenerate unrelated parts of the image.",
  "Output exactly one photorealistic edited image.",
].join("\n");

const VIBE_RULES = [
  "If multiple photos are provided: the first is a style/lighting/wardrobe reference only (not the output identity).",
  "Later photo(s) are the SUBJECT identity: face, body, natural hair color.",
  "Output one new photograph of the subject as if shot in the reference session.",
  "Do not copy the reference person's face.",
].join("\n");

function joinPrompt(body: string, rules: string): string {
  const scene = String(body ?? "").trim();
  if (!scene) return rules;
  return `${scene}\n\n${rules}`;
}

export function assembleGrokTextToImagePrompt(rawPrompt: string): string {
  return joinPrompt(rawPrompt, TEXT_ONLY_RULES);
}

export function assembleGrokImageToImagePrompt(rawPrompt: string): string {
  return joinPrompt(rawPrompt, IDENTITY_RULES);
}

export function assembleGrokImageEditPrompt(editInstruction: string): string {
  const instruction = String(editInstruction ?? "").trim();
  return joinPrompt(
    instruction ? `EDIT REQUEST (HIGHEST PRIORITY)\n${instruction}` : "",
    EDIT_RULES,
  );
}

export function assembleGrokVibePrompt(
  rawExpandedPrompt: string,
  hasStyleReference: boolean,
): string {
  return joinPrompt(rawExpandedPrompt, hasStyleReference ? VIBE_RULES : IDENTITY_RULES);
}
