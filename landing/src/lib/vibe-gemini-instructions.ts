/**
 * Shared Gemini instructions + defaults for vibe extract / expand.
 * Single source of truth for route handlers and /api/vibe/pipeline-spec.
 */

export const STYLE_FIELDS = [
  "scene",
  "genre",
  "lighting",
  "camera",
  "mood",
  "color_palette",
  "color_grading",
  "clothing",
  "environment",
  "composition",
  "key_details",
] as const;

export type StyleField = (typeof STYLE_FIELDS)[number];
export type StylePayload = Record<StyleField, string>;

const OPTIONAL_STYLE_FIELDS: readonly StyleField[] = ["clothing"];
const ARRAY_STYLE_FIELDS: readonly StyleField[] = ["key_details"];

export function coerceStylePayload(input: unknown): StylePayload | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const result = {} as StylePayload;
  for (const field of STYLE_FIELDS) {
    const value = raw[field];
    if (ARRAY_STYLE_FIELDS.includes(field)) {
      if (Array.isArray(value)) {
        result[field] = value.map(String).join("; ");
        continue;
      }
    }
    if (typeof value === "string") {
      const normalized = value.trim();
      if (!normalized && !OPTIONAL_STYLE_FIELDS.includes(field)) return null;
      result[field] = normalized;
      continue;
    }
    if (OPTIONAL_STYLE_FIELDS.includes(field)) {
      result[field] = "";
      continue;
    }
    return null;
  }
  return result;
}

export function getGeminiVibeExtractModel(): string {
  return process.env.GEMINI_VIBE_EXTRACT_MODEL || "gemini-2.5-flash";
}

export function getGeminiVibeExpandModel(): string {
  return process.env.GEMINI_VIBE_EXPAND_MODEL || "gemini-2.5-flash";
}

export const EXTRACT_STYLE_INSTRUCTION = `
Analyze this image and extract its complete visual style so another AI model can recreate this exact vibe with a different person's photo.

Return a JSON object with these exact fields:

- scene: What is depicted — subject, setting, action, time of day. 2-3 sentences. Be specific about the environment.
- genre: The photographic genre (fashion editorial, street photography, portrait, lifestyle, etc.)
- lighting: Direction, quality (hard/soft), color temperature (warm/cool Kelvin range), shadow density, light sources (natural window light, studio softbox, golden hour, neon, etc.)
- camera: Estimated lens (35mm, 50mm, 85mm, etc.), depth of field (shallow/deep), shooting angle (eye-level, low, overhead), distance (close-up, medium, full-body).
- mood: The emotional tone — 2-3 sentences. What feeling does this image evoke? What story does it tell?
- color_palette: List 4-6 dominant colors as descriptive names (e.g. "warm terracotta", "muted sage green", "deep navy"). Note overall warmth/coolness.
- color_grading: Contrast level (low/medium/high), saturation (muted/natural/vibrant), shadows tint (warm/cool/neutral), highlights tint, any visible film emulation or filter look.
- clothing: Detailed description — garment types, fabrics (knit, silk, denim, leather), colors, patterns, fit (oversized, fitted, layered). Include accessories (jewelry, bags, hats, glasses). Empty string if no person.
- environment: Specific background elements — surfaces (brick wall, wooden floor, marble), objects/props (coffee cup, books, plants, neon sign), textures, materials. Indoor/outdoor. Urban/natural.
- composition: Framing (tight crop, wide shot, centered, off-center), rule of thirds placement, negative space usage, leading lines, symmetry.
- key_details: Array of 3-5 specific visual details that make this image distinctive and must be replicated to preserve the vibe (e.g. "steam rising from coffee cup", "golden hour rim light on hair", "crumpled newspaper on table").

Be extremely specific and concrete. Avoid generic descriptions like "warm tones" — instead say "amber-orange tones with desaturated shadows leaning teal". The goal is to capture every reproducible visual attribute.
Return ONLY valid JSON, no markdown.
`.trim();

/**
 * Prepended to every generation prompt in generate-process.
 * Tells Gemini the attached photo is the subject to restyle, not a generic reference.
 */
export const GENERATE_VIBE_PREFIX = `
IMPORTANT INSTRUCTIONS — read before looking at the prompt below.
The attached photo shows the SUBJECT. Your task is to RESTYLE this photo to match the described vibe.
Preserve the person's face, skin tone, hair color and hairstyle, and body proportions exactly — they must be clearly recognizable.
Apply ALL described style details: clothing, environment/background, lighting, color grading, props, and atmosphere.
Do NOT invent new elements that are not described. Follow the prompt precisely.

`.trimStart();

export const EXPAND_PROMPTS_INSTRUCTION = `
You are a prompt engineer for AI image generation. Your task: turn a detailed style description into prompts that will restyle a user's photo to match this exact vibe.

Given the style JSON, generate exactly 3 prompts. Each prompt MUST include ALL of these visual details from the style:
- Clothing (garments, fabrics, colors, accessories — copy specifics from the style)
- Environment/background (surfaces, props, textures — be concrete)
- Color grading (palette, contrast, saturation, shadow/highlight tints)
- Lighting setup (direction, quality, temperature)
- Mood and atmosphere

Each prompt focuses on a different accent but NEVER omits the other details:
- Prompt A (accent: lighting): lead with lighting, but include full clothing + environment + color
- Prompt B (accent: mood): lead with atmosphere/emotion, but include full clothing + environment + color
- Prompt C (accent: composition): lead with framing/angles, but include full clothing + environment + color

Rules:
1. Start each prompt with "Restyle the person in the attached photo:"
2. Length: 80-180 words per prompt — be detailed, not generic
3. Always include specific clothing items and environment props from the style
4. Include the color grading details (not just "warm tones" — say exactly which tones)
5. Include any key_details from the style verbatim — these are the vibe anchors
6. The prompt must be directly usable as a Gemini image generation prompt with an attached photo

Return ONLY valid JSON array with 3 objects:
[
  { "accent": "lighting", "prompt": "..." },
  { "accent": "mood", "prompt": "..." },
  { "accent": "composition", "prompt": "..." }
]
`.trim();
