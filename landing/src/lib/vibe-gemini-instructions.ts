/**
 * Shared Gemini instructions + defaults for vibe extract / expand.
 * Single source of truth for route handlers and /api/vibe/pipeline-spec.
 */

export function getGeminiVibeExtractModel(): string {
  return process.env.GEMINI_VIBE_EXTRACT_MODEL || "gemini-2.5-flash";
}

export function getGeminiVibeExpandModel(): string {
  return process.env.GEMINI_VIBE_EXPAND_MODEL || "gemini-2.5-flash";
}

export const EXTRACT_STYLE_INSTRUCTION = `
Analyze this image and extract its visual style as a structured description.
Return a JSON object with these exact fields:

- scene: What is depicted (subject, setting, action). 1-2 sentences.
- genre: The photographic genre (fashion editorial, street photography, portrait, etc.)
- lighting: Describe the lighting setup, direction, quality, color temperature.
- camera: Lens, focal length, depth of field, angle, distance.
- mood: The emotional tone and atmosphere.
- color: Color palette, grading, contrast, saturation levels.
- clothing: What the subject is wearing (if applicable, empty string if not).
- composition: Framing, rule of thirds, negative space, leading lines.

Be specific and precise. Focus on reproducible visual attributes.
Return ONLY valid JSON, no markdown.
`.trim();

export const EXPAND_PROMPTS_INSTRUCTION = `
You are a prompt engineer for AI image generation.

Given a structured style description of a photo, generate exactly 3 prompts for recreating this style with a different person's photo.

Each prompt must:
1. Include "the person in the provided reference photo" phrase
2. Be 1-3 sentences, 30-80 words
3. Focus on a different visual accent:
   - Prompt A: emphasize LIGHTING (direction, quality, color temperature, shadows)
   - Prompt B: emphasize MOOD (atmosphere, emotion, narrative)
   - Prompt C: emphasize COMPOSITION (framing, angles, spatial arrangement)
4. Include all style elements but weight the accent aspect more heavily
5. Be directly usable as a Gemini image generation prompt

Return ONLY valid JSON array with 3 objects and exact accents:
[
  { "accent": "lighting", "prompt": "..." },
  { "accent": "mood", "prompt": "..." },
  { "accent": "composition", "prompt": "..." }
]
`.trim();
