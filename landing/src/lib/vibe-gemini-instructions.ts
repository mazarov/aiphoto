/**
 * Shared Gemini instructions + defaults for vibe extract / expand.
 * Single source of truth for route handlers and /api/vibe/pipeline-spec.
 */

export const STYLE_FIELDS = [
  "scene",
  "genre",
  "subject_pose",
  "expression",
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

/** If missing, Gemini output still validates (expand can work with partial palette text). */
const STYLE_FIELDS_DEFAULT_EMPTY: readonly StyleField[] = [
  "clothing",
  "key_details",
  "color_palette",
  "color_grading",
  "environment",
];

/** Must be non-empty after coercion — core vibe fields. */
const STYLE_FIELDS_REQUIRED_NON_EMPTY: readonly StyleField[] = [
  "scene",
  "genre",
  "subject_pose",
  "expression",
  "lighting",
  "camera",
  "mood",
  "composition",
];

/** Alternate keys models sometimes return instead of canonical names. */
const STYLE_FIELD_ALIASES: Partial<Record<StyleField, readonly string[]>> = {
  subject_pose: ["pose", "body_position", "posture", "body_pose"],
  expression: ["facial_expression", "face_expression", "emotion"],
  color_palette: ["color", "colors", "palette"],
  environment: ["background", "setting", "location"],
  key_details: ["details", "distinctive_details", "anchors"],
};

function pickRawStyleValue(raw: Record<string, unknown>, field: StyleField): unknown {
  const direct = raw[field];
  if (direct !== undefined && direct !== null) return direct;
  const aliases = STYLE_FIELD_ALIASES[field];
  if (aliases) {
    for (const key of aliases) {
      const v = raw[key];
      if (v !== undefined && v !== null) return v;
    }
  }
  return undefined;
}

function coerceStyleValueToString(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((x) => String(x).trim())
      .filter(Boolean)
      .join("; ");
  }
  return "";
}

export function coerceStylePayload(input: unknown): StylePayload | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const result = {} as StylePayload;

  for (const field of STYLE_FIELDS) {
    const value = pickRawStyleValue(raw, field);
    const str = coerceStyleValueToString(value);

    if (str.length > 0) {
      result[field] = str;
      continue;
    }

    if (STYLE_FIELDS_DEFAULT_EMPTY.includes(field)) {
      result[field] = "";
      continue;
    }

    if (STYLE_FIELDS_REQUIRED_NON_EMPTY.includes(field)) {
      return null;
    }

    result[field] = "";
  }

  return result;
}

/** When coerceStylePayload returns null — which required fields are still empty (after aliases). */
export function getStyleCoerceDiagnostics(input: unknown): {
  accepted: boolean;
  rawKeys: string[];
  missingRequired: string[];
} {
  if (!input || typeof input !== "object") {
    return { accepted: false, rawKeys: [], missingRequired: ["<not_an_object>"] };
  }
  const raw = input as Record<string, unknown>;
  const rawKeys = Object.keys(raw);
  if (coerceStylePayload(input)) {
    return { accepted: true, rawKeys, missingRequired: [] };
  }
  const missing: string[] = [];
  for (const field of STYLE_FIELDS_REQUIRED_NON_EMPTY) {
    const str = coerceStyleValueToString(pickRawStyleValue(raw, field));
    if (!str) missing.push(field);
  }
  return { accepted: false, rawKeys, missingRequired: missing };
}

export function getGeminiVibeExtractModel(): string {
  return process.env.GEMINI_VIBE_EXTRACT_MODEL || "gemini-2.5-flash";
}

export function getGeminiVibeExpandModel(): string {
  return process.env.GEMINI_VIBE_EXPAND_MODEL || "gemini-2.5-flash";
}

export const EXTRACT_STYLE_INSTRUCTION = `
Analyze this reference image and extract every visual detail needed to recreate this exact scene with a different person. The output will guide an AI image generation model — be extremely specific and concrete.

Return a JSON object with these exact fields:

- scene: What is happening in this image. Describe the setting, action, time of day, and spatial context. 2-3 sentences. Example: "A woman lying on a bed of white crumpled sheets, taking a selfie from above. Morning light fills the room. The frame is intimate and close."
- genre: The photographic genre and substyle. Examples: "intimate lifestyle portrait", "high-fashion editorial", "candid street photography", "cozy bedroom selfie".
- subject_pose: CRITICAL FIELD. Describe the full body position with precision: standing/sitting/lying/leaning? Which direction? Hand placement (holding phone, resting on cheek, behind head, etc.). Head angle and tilt. Gaze direction (into camera, away, down). Shoulder position. Leg arrangement if visible. Be as specific as a film director giving blocking instructions. Example: "Lying on back, head on pillow tilted slightly left, right arm extended up holding phone for overhead selfie, left hand resting near face, relaxed open body language, legs slightly bent under sheets."
- expression: The precise facial expression and emotional state. Not just "smiling" — describe the quality: "soft relaxed half-smile, slightly parted lips, heavy-lidded dreamy eyes looking directly into camera with quiet confidence." Include micro-details: teeth showing or not, eyebrow position, eye squint level.
- lighting: Direction (front/side/back/above), quality (hard shadows/soft diffused), color temperature (specify Kelvin range or descriptive: "warm golden 3000K"), shadow density (deep/medium/light), specific light sources (window light from left, overhead ring light, golden hour backlight, neon reflection, etc.). Example: "Soft diffused natural light from a window on the right side, warm 3500K temperature, very light shadows, no harsh contrasts, subtle warm glow on skin."
- camera: Estimated focal length (24mm/35mm/50mm/85mm/135mm), depth of field (shallow bokeh/medium/deep), shooting angle (overhead looking down, eye-level, low angle looking up, 45-degree), distance to subject (extreme close-up, close-up face+shoulders, medium shot waist-up, full body), tilt if any. Example: "Wide-angle ~24mm, overhead top-down angle, close-up covering face and upper body, shallow depth of field with sheets blurred at edges."
- mood: The emotional atmosphere in 2-3 sentences. What feeling does this image evoke? What story does it tell? What is the viewer's relationship to the subject — voyeuristic, intimate, distant, confrontational? Example: "Intimate and personal, like a private morning moment shared between lovers. The mood is warm, unhurried, sensual without being explicit. The viewer feels like they are the one being looked at."
- color_palette: List 4-6 dominant colors as specific descriptive names. Note overall warmth/coolness and any color harmony pattern. Example: "creamy ivory whites, warm peachy skin tones, soft blush pink, light honey gold highlights, pale lavender shadows. Overall very warm and desaturated."
- color_grading: Contrast level (low/medium/high), saturation style (muted/natural/vibrant/desaturated pastels), shadows tint (warm amber/cool blue/neutral), highlights tint (warm/cool/neutral), any visible film look or filter emulation. Example: "Low contrast, slightly desaturated with warm peachy cast, shadows tinted warm amber, highlights creamy and soft, resembles analog film with slight grain."
- clothing: Detailed description of garments, fabrics, colors, fit, and state (buttoned/unbuttoned, tucked/untucked, sleeves rolled). Include accessories and their placement. Describe texture (knit, silk, cotton, denim). If partially clothed or implied nudity, describe exactly what is visible and covered. Empty string if not applicable.
- environment: Every visible background element with specific materials and textures. Surfaces (wrinkled white cotton sheets, weathered brick, polished concrete). Objects and props with their positions (coffee cup on nightstand to the left, crumpled pillow, phone charging cable). Indoor/outdoor. Room type if identifiable. Example: "White cotton bed sheets, slightly crumpled and wrinkled, one white pillow under the head, bedframe not visible, no other furniture or objects in frame, bright clean minimal bedroom."
- composition: Framing (tight crop, wide, centered, rule-of-thirds), subject placement in frame, negative space distribution, leading lines, symmetry/asymmetry, aspect ratio feel (square, portrait, landscape). Example: "Overhead top-down composition, subject centered filling most of frame, slight diagonal body angle from bottom-left to top-right, minimal negative space at edges, intimate tight framing."
- key_details: Array of 3-5 unique visual details that define this image's distinctive character and MUST be present in the recreation. Focus on details that make the difference between "generic" and "this exact vibe." Example: ["hair fanned out naturally on white pillow", "one arm reaching up toward camera creating depth", "soft morning window light creating warm glow on skin", "slightly crumpled white sheets framing the body", "direct intimate eye contact with camera from below"].

Be surgically precise. Avoid vague descriptions like "warm tones" or "natural look." Every field should contain enough detail that a blind person could understand exactly what this image looks like.
Return ONLY valid JSON, no markdown.
`.trim();

/**
 * Prepended to every generation prompt in generate-process.
 * Two-image mode: parts order is [reference, subject_photo(s), text] so the subject
 * is the last image before the prompt (Gemini image models weight that strongly).
 * Falls back to single-image mode when no reference is available.
 */
export const GENERATE_VIBE_PREFIX_TWO_IMAGES = `
CRITICAL INSTRUCTIONS — read carefully before the prompt.

Image order in this request (before this text): FIRST image = style reference only. LAST image = the SUBJECT user photo (identity you must keep).

You are given TWO images:
- IMAGE 1 (first image): STYLE REFERENCE — mood, pose, scene, lighting, outfit style, composition. Do NOT copy this person's face or identity; it is only a visual recipe.
- IMAGE 2 (last image, immediately before this text): The SUBJECT — the real user. The output MUST clearly show THIS person's face and recognizable identity.

YOUR TASK: Create a NEW photorealistic image where the person from Image 2 (the subject) is placed into a scene that recreates the look, feel, and atmosphere of Image 1 (the reference).

IDENTITY (from Image 2 — the LAST image — PRESERVE exactly):
- Face structure, bone structure, facial features, skin tone, eye color, eye shape
- Body proportions and build
- Natural hair color and texture

STYLE (from Image 1 — RECREATE everything in the output, applied to the subject from Image 2):
- Pose, body position, and body language — match the reference pose, NOT the subject's original pose
- Environment, setting, surfaces, props, background
- Lighting direction, quality, color temperature, shadow patterns
- Color grading, contrast, saturation, color palette
- Clothing style, fabrics, fit (adapt to the subject's body)
- Mood, atmosphere, emotional tone
- Camera angle, framing, composition, depth of field
- Hair styling and arrangement (adapt subject's hair to match reference styling)
- Facial expression and emotional state from the reference

The result must look like the subject from Image 2 was ACTUALLY PHOTOGRAPHED in the reference scene — not composited or photoshopped. Natural skin texture, realistic lighting interaction with face and body, proper perspective.

Never output a copy of Image 1 alone. Never replace the subject's face with the reference person's face.

The text prompt below provides additional specific details. Follow it precisely.

`.trimStart();

export const GENERATE_VIBE_PREFIX_SINGLE_IMAGE = `
CRITICAL INSTRUCTIONS — read carefully before the prompt.

The attached photo shows the SUBJECT — a real person whose identity must be preserved.
Your task is to CREATE A NEW photorealistic image of this person placed into the scene described below.

PRESERVE exactly: face structure, facial features, skin tone, eye color, body proportions, natural hair color.
CHANGE to match the description: pose, body position, clothing, hairstyle arrangement, environment, lighting, color grading, camera angle, expression.

The person must look like they were ACTUALLY PHOTOGRAPHED in the described setting — natural, realistic, belonging to the scene. Not composited or pasted.

Follow the text prompt below for all scene details.

`.trimStart();

export const EXPAND_PROMPTS_INSTRUCTION = `
You are an expert prompt engineer for photorealistic AI image generation. Your task: turn a style description into 3 detailed scene prompts. These prompts will be used alongside a reference image, so they serve as ENRICHMENT and SPECIFICITY — the model already sees the visual reference.

Given the style JSON, generate exactly 3 prompts. Each prompt describes the SAME scene but with a different creative emphasis.

EVERY prompt MUST include ALL of these elements (never skip any):
1. SUBJECT POSE — exact body position, hand placement, head angle, gaze direction (from subject_pose field). This is THE most critical element. Without correct pose the result looks wrong.
2. EXPRESSION — exact facial expression, emotion, micro-details like smile type, eye quality (from expression field)
3. CAMERA — focal length, angle, distance, depth of field (from camera field)
4. LIGHTING — direction, quality, temperature, shadow pattern, sources (from lighting field)
5. ENVIRONMENT — specific surfaces, textures, props with positions (from environment field)
6. CLOTHING — garments, fabrics, colors, fit, accessories (from clothing field)
7. COLOR GRADING — palette, contrast, saturation, shadow/highlight tints (from color_grading + color_palette fields)
8. MOOD — emotional atmosphere, story, viewer relationship (from mood field)
9. KEY DETAILS — include ALL key_details verbatim as they are the vibe anchors

Each prompt uses a different creative emphasis:
- Prompt A (accent: lighting): Open with the lighting setup, then weave in all other elements naturally
- Prompt B (accent: mood): Open with the emotional atmosphere and story, then describe the physical scene
- Prompt C (accent: composition): Open with camera angle and framing, then describe the scene within that frame

Rules:
1. Start each prompt with: "Using the SUBJECT portrait (the user's photo, the last image before this text — not the style-reference image), place this person into this scene:"
2. Length: 150-300 words per prompt — be richly detailed, never generic
3. Describe the pose as if directing an actor: "lying on back with right arm reaching up toward camera, head tilted slightly left on pillow, left hand resting near face"
4. Describe expression precisely: "soft half-smile with slightly parted lips, heavy-lidded eyes looking directly into camera"
5. NEVER use vague phrases like "warm tones", "natural lighting", "casual pose" — always specify exactly
6. Include specific textures: "crumpled white cotton sheets", not just "white sheets"
7. The prompt must work as a Gemini image generation prompt paired with subject photo + reference image

Return ONLY valid JSON array with 3 objects:
[
  { "accent": "lighting", "prompt": "..." },
  { "accent": "mood", "prompt": "..." },
  { "accent": "composition", "prompt": "..." }
]
`.trim();
