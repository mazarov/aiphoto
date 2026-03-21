/**
 * Shared Gemini instructions + defaults for vibe extract / expand.
 * Single source of truth for route handlers and /api/vibe/pipeline-spec.
 */

import { createSupabaseServer } from "@/lib/supabase";

export const PHOTO_APP_CONFIG_KEY_VIBE_ATTACH_REFERENCE =
  "vibe_attach_reference_image_to_generation";

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

Note: The JSON describes THIS reference shot only (including this model's hair, eyes, skin in palette/expression where visible). A later step swaps in the end user's face. Accurate reference documentation is good; identity transfer is handled separately — do not omit real details from the photo.

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

/** Placed immediately BEFORE the reference inline image in the multi-part request. */
export const VIBE_IMAGE_PART_LABEL_REFERENCE = `
[IMAGE A — STYLE REFERENCE ONLY]
The NEXT part is a photograph used ONLY as a recipe: pose, lighting, wardrobe style, background, camera, color grade, mood.
It is NOT the person to depict in the output. Do NOT copy this person's face, bone structure, skin, eyes, or hair color as the result identity.
`.trim();

/** Placed immediately BEFORE the user's photo inline image(s). */
export const VIBE_IMAGE_PART_LABEL_SUBJECT = `
[IMAGE B — SUBJECT / USER IDENTITY]
The NEXT part is the ONLY source for who the person in the output must be. The output face MUST match this person (same identity).
If the result looks like IMAGE A's model, you FAILED — redo mentally until the face matches IMAGE B.
`.trim();

/**
 * Prepended when generate-process attaches reference + user (interleaved labels + images + text).
 */
export const GENERATE_VIBE_PREFIX_TWO_IMAGES = `
CRITICAL INSTRUCTIONS — read carefully before the prompt.

REQUEST LAYOUT (multi-part message):
1) A short text label, then IMAGE A — the STYLE REFERENCE photograph (pose, light, set, wardrobe, camera, color grade, mood).
2) A short text label, then IMAGE B — the SUBJECT / USER (the only source for who the person in the output must be).

YOUR TASK: Create a NEW photorealistic image where the person from IMAGE B is placed into a scene that recreates the look, feel, and atmosphere of IMAGE A — as if B had been photographed in that same shoot. Not a lazy crop of B's selfie. Not a face-swap onto A.

IDENTITY (from IMAGE B — preserve exactly):
- Face structure, bone structure, facial features, skin tone, eye color and shape, brows, nose, lips, ears, apparent age
- Body proportions and build
- Natural hair color and texture (do not recolor B to match A's hair)

STYLE & SCENE (from IMAGE A + the text below — apply onto B):
- Pose, body position, and body language — match IMAGE A, NOT B's original pose in their upload
- Hair STYLING and arrangement — adapt B's hair to match the reference look (part, length layout, fall over shoulders, etc.) without turning B into A's face
- Facial expression mood and performance from the reference (smile quality, gaze intensity) while keeping B recognizable
- Environment, setting, surfaces, props, background
- Lighting: direction, quality, color temperature, shadow pattern
- Color grading, contrast, saturation, palette of the shot
- Clothing: style, fabrics, colors, fit — worn naturally on B's body
- Camera: angle, framing, composition, depth of field, lens feel

The result must look like B was ACTUALLY PHOTOGRAPHED in that reference scene — natural integration, not composited or pasted.

Output must be a single seamless photograph — one coherent frame. FORBIDDEN: tiling, side-by-side panels, vertical/horizontal stitching, collage, diptych, or any composition that looks like two photos glued together. Do not paste B's face as a cutout on top of A.

The text prompt below adds director-level specificity. Follow it precisely. Never let prose describing "the model in the reference" override IMAGE B's identity.

`.trimStart();

export const GENERATE_VIBE_PREFIX_SINGLE_IMAGE = `
CRITICAL INSTRUCTIONS — read carefully before the prompt.

The attached photo shows the SUBJECT — a real person whose identity must be preserved.
Your task is to CREATE ONE NEW photorealistic image of this person placed into the scene described below.

PRESERVE exactly: face structure, facial features, skin tone, eye color, body proportions, natural hair color.
CHANGE to match the description: pose, body position, clothing, hairstyle arrangement, environment, lighting, color grading, camera angle, expression.

The paragraph below was written from a style JSON about a reference shoot. If it mentions hair/eyes/skin of "another" model, ignore that for identity — use ONLY the attached photo for who the person is. Still follow that text for pose, light, wardrobe, set, and grade.

Output must be a single seamless photograph — one coherent frame. FORBIDDEN: tiling, side-by-side panels, vertical/horizontal stitching, collage, or any composition that looks like two photos glued together. Do not paste the subject onto a strip of another image.

The person must look like they were ACTUALLY PHOTOGRAPHED in the described setting — natural, realistic, belonging to the scene. Not composited or pasted.

Scene description:

`.trimStart();

/** Bridge only for dual-image requests (after TWO_IMAGES prefix, before expanded prose). */
export const GENERATE_VIBE_JSON_IDENTITY_BRIDGE_DUAL = `

JSON-TO-SCENE REMINDER: The detailed prompt below was expanded from a style JSON about the REFERENCE shoot. Any hair/eye/skin/face wording there describes IMAGE A's model — IGNORE for identity. The ONLY identity source is IMAGE B (the user photo, after its [IMAGE B] label). Transfer pose, light, set, clothes, grade, mood from the text onto B's face.

`;

/**
 * Expand step: tells Gemini whether image-gen will attach reference pixels.
 */
export function buildVibeExpandRuntimeContext(willAttachReferenceInline: boolean): string {
  if (willAttachReferenceInline) {
    return `
RUNTIME CONTEXT (do not repeat this label in your JSON; use it only for phrasing):
The image generation step will receive TWO inputs in order: first the REFERENCE photo (IMAGE A — style anchor), then the USER photo (IMAGE B — identity). The model sees both pixels — your prompt adds director-level detail (blocking, textures, micro-expression). Strongly align pose, framing, and lighting with what IMAGE A shows; the face must remain the user from IMAGE B.
`.trim();
  }
  return `
RUNTIME CONTEXT:
The image generation API receives ONLY the USER photograph plus your text — reference / Pinterest image pixels are not sent to the image model. The style JSON is the sole recipe for the reference look: spell out pose, hands, head tilt, gaze, wardrobe, set, and light with maximum precision so the model can rebuild the scene from words alone.
`.trim();
}

function parseBoolConfigValue(value: string | null | undefined, fallback: boolean): boolean {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return fallback;
  if (["true", "1", "yes", "y", "on"].includes(raw)) return true;
  if (["false", "0", "no", "n", "off"].includes(raw)) return false;
  return fallback;
}

/**
 * Source of truth: `photo_app_config` row `vibe_attach_reference_image_to_generation` (`true`/`false`).
 * Fallback if row missing / empty / read error: env `VIBE_ATTACH_REFERENCE_IMAGE_TO_GENERATION`, then default **true**.
 */
export async function getVibeAttachReferenceImageToGeneration(
  supabase: ReturnType<typeof createSupabaseServer>
): Promise<boolean> {
  const envFallback = parseBoolConfigValue(process.env.VIBE_ATTACH_REFERENCE_IMAGE_TO_GENERATION, true);

  try {
    const { data, error } = await supabase
      .from("photo_app_config")
      .select("value")
      .eq("key", PHOTO_APP_CONFIG_KEY_VIBE_ATTACH_REFERENCE)
      .maybeSingle();

    if (error) {
      console.warn("[vibe.config] photo_app_config read failed", {
        key: PHOTO_APP_CONFIG_KEY_VIBE_ATTACH_REFERENCE,
        message: error.message,
      });
      return envFallback;
    }

    const v = data?.value;
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return parseBoolConfigValue(String(v), envFallback);
    }
  } catch (err) {
    console.warn("[vibe.config] photo_app_config read threw", {
      key: PHOTO_APP_CONFIG_KEY_VIBE_ATTACH_REFERENCE,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  return envFallback;
}

export const EXPAND_PROMPTS_INSTRUCTION = `
You are an expert prompt engineer for photorealistic AI image generation. Your task: turn a style JSON (extracted from a REFERENCE photo) into ONE rich scene prompt for a DIFFERENT person (the end user's face will come from their attached photograph).

The JSON documents the reference shoot. The OUTPUT must depict the USER's real identity (face, skin tone, eye color, hair color, bone structure) — not the reference model's face. Transfer the SCENE: pose, light, wardrobe, environment, camera, grade, mood.

Generate exactly ONE prompt. In that single text, weave together what used to be three accent variants (lighting-led, mood-led, composition-led) into one flowing scene: open with strong lighting and color-grade cues, carry emotional atmosphere through the middle, and lock framing/camera/pose explicitly — without omitting any required element below.

THE PROMPT MUST COVER ALL of these (woven into prose, not as a markdown list):
1. SUBJECT POSE — from subject_pose: full blocking — body, hands, head tilt, gaze direction. This is the highest priority for "wow"; be as specific as a film director.
2. EXPRESSION — from expression: micro-details (smile type, lips, eyes, brows).
3. CAMERA — from camera: focal length, angle, distance, depth of field.
4. LIGHTING — from lighting: direction, quality, temperature, shadows, sources.
5. ENVIRONMENT — from environment: surfaces, textures, props and positions.
6. CLOTHING — from clothing: garments, fabrics, fit, accessories (wardrobe on the user).
7. COLOR GRADING — from color_grading + color_palette: concrete photographic look (shadow/highlight tint, saturation, contrast). Rephrase palette terms as light and set (e.g. "warm rim on hair", "sage wall") without assigning the reference model's hair/eye/skin colors as the user's identity.
8. MOOD — from mood: atmosphere and viewer relationship, addressed to "the subject" / "the person".
9. KEY DETAILS — rewrite each key_detail into a transferable anchor for the USER: keep composition/light/prop/jewelry/fabric beats, but strip or generalize ANY reference-only biometrics (eye color, hair color, skin tone, face shape, "emerald eyes", "long dark hair", etc.). Never quote key_details verbatim if they describe the reference model's face or body — rephrase as "intense direct gaze with the subject's natural eye color", "hair styled with a braid using the subject's natural hair color and length", etc.

Rules:
1. Start the prompt with: "Place the person from the attached photo into this scene:"
2. Length: 200-380 words in one continuous paragraph (or two short paragraphs if needed for clarity).
3. NEVER vague phrases like "natural lighting" or "warm tones" without saying exactly where and how.
4. Remind at least once that facial identity must match the attached user/subject photo only.

Return ONLY a valid JSON object (not an array):
{ "prompt": "..." }
`.trim();

/**
 * Full text sent to Gemini image generation for vibe rows (must match generate-process).
 * `assumeReferenceImageLoaded`: true only when reference inline image is actually attached
 * (or, in expand preview, when we intend to attach and have source_image_url).
 */
export function assembleVibeFinalPrompt(
  rawExpandedPrompt: string,
  assumeReferenceImageLoaded = false
): string {
  if (assumeReferenceImageLoaded) {
    return GENERATE_VIBE_PREFIX_TWO_IMAGES + GENERATE_VIBE_JSON_IDENTITY_BRIDGE_DUAL + rawExpandedPrompt;
  }
  return GENERATE_VIBE_PREFIX_SINGLE_IMAGE + rawExpandedPrompt;
}
