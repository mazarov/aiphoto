/**
 * Shared Gemini instructions + defaults for vibe extract / expand.
 * Single source of truth for route handlers and /api/vibe/pipeline-spec.
 */

import { createSupabaseServer } from "@/lib/supabase";

export const PHOTO_APP_CONFIG_KEY_VIBE_ATTACH_REFERENCE =
  "vibe_attach_reference_image_to_generation";

/** Gemini model id for `/api/vibe/extract` (vision → style JSON). */
export const PHOTO_APP_CONFIG_KEY_VIBE_EXTRACT_MODEL = "vibe_extract_model";

/** Gemini model id for `/api/vibe/expand` (text → scene prompt JSON). */
export const PHOTO_APP_CONFIG_KEY_VIBE_EXPAND_MODEL = "vibe_expand_model";

/** Default when DB row missing and env unset — Pro for sharper pose/geometry from reference pixels. */
export const DEFAULT_GEMINI_VIBE_EXTRACT_MODEL = "gemini-2.5-pro";

/** Default when DB row missing and env unset — Flash for fast text expand. */
export const DEFAULT_GEMINI_VIBE_EXPAND_MODEL = "gemini-2.5-flash";

/** When true, `/api/vibe/extract` outputs `{ "prompt": "..." }` in one vision call; expand uses DB prefilled row. */
export const PHOTO_APP_CONFIG_KEY_VIBE_ONE_SHOT_EXTRACT_PROMPT = "vibe_one_shot_extract_prompt";

/** Minimum length for `prompt` from expand JSON or one-shot extract. */
export const MIN_VIBE_SCENE_PROMPT_CHARS = 600;

/** `gemini` | `openai` — which backend runs `/api/vibe/extract` (vision → JSON / one-shot prompt). */
export const PHOTO_APP_CONFIG_KEY_VIBE_EXTRACT_LLM = "vibe_extract_llm";

/** `gemini` | `openai` — which backend runs `/api/vibe/expand` (style JSON → scene prompt). */
export const PHOTO_APP_CONFIG_KEY_VIBE_EXPAND_LLM = "vibe_expand_llm";

/** OpenAI model when `vibe_extract_llm` = openai (vision-capable, e.g. gpt-4o). */
export const PHOTO_APP_CONFIG_KEY_VIBE_OPENAI_EXTRACT_MODEL = "vibe_openai_extract_model";

/** OpenAI model when `vibe_expand_llm` = openai (text JSON). */
export const PHOTO_APP_CONFIG_KEY_VIBE_OPENAI_EXPAND_MODEL = "vibe_openai_expand_model";

export const DEFAULT_OPENAI_VIBE_EXTRACT_MODEL = "gpt-4o";

export const DEFAULT_OPENAI_VIBE_EXPAND_MODEL = "gpt-4.1-mini";

export const STYLE_FIELDS = [
  "scene",
  "genre",
  "subject_pose",
  "expression",
  "hair_makeup",
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
  "hair_makeup",
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
  camera: ["lens", "camera_settings", "photography", "optics"],
  composition: ["framing", "crop", "shot_composition"],
  hair_makeup: ["grooming", "hair_and_makeup", "hair_styling_makeup", "beauty_look", "hair_styling", "makeup"],
};

/**
 * Gemini sometimes returns "" for camera/composition despite valid JSON; patch so extract does not fail.
 */
const STYLE_REQUIRED_STRING_FALLBACKS: Partial<Record<StyleField, string>> = {
  camera:
    "Estimated from the reference image: portrait-style focal length (approx. 50–105mm), camera height and angle consistent with visible perspective, depth of field matching background blur; refine from pixels.",
  composition:
    "Match the reference crop: subject placement in frame, headroom, symmetry/asymmetry, and negative space as visible in the photograph.",
  hair_makeup:
    "From the reference: recreate the same hair STYLING (part, volume, waves/sleek/updo/braid, flyaways, shine/matte) and MAKEUP (eye look, lip color/finish, brows, blush/contour, skin finish) on the subject's own face and natural hair color — the result must not look like an unchanged casual selfie.",
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
      result[field] = "";
      continue;
    }

    result[field] = "";
  }

  for (const field of STYLE_FIELDS_REQUIRED_NON_EMPTY) {
    const cur = String(result[field] ?? "").trim();
    if (cur.length > 0) continue;
    const fallback = STYLE_REQUIRED_STRING_FALLBACKS[field];
    if (fallback) {
      result[field] = fallback;
      continue;
    }
    return null;
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

/**
 * Stored in `vibes.style` when extract used one-shot mode — valid `StylePayload`, SEO-friendly text from the same prompt.
 */
export function buildOneShotVibeStyleFromPrompt(rawPrompt: string): StylePayload {
  const p = rawPrompt.trim();
  const clip = (max: number) => (p.length <= max ? p : `${p.slice(0, max)}…`);
  return {
    scene: clip(900),
    genre: "reference-matched portrait (one-shot pipeline)",
    subject_pose: clip(800),
    expression: clip(600),
    hair_makeup: clip(700),
    lighting: clip(700),
    camera: clip(500),
    mood: clip(500),
    composition: clip(600),
    color_palette: "",
    color_grading: "",
    clothing: clip(600),
    environment: clip(600),
    key_details: clip(1200),
  };
}

async function getVibeModelStringFromPhotoAppConfig(
  supabase: ReturnType<typeof createSupabaseServer>,
  configKey: string,
  envVarName: string,
  codeDefault: string,
  logLabel: string
): Promise<string> {
  const envTrimmed = String(process.env[envVarName] ?? "").trim();
  const fallbackModel = envTrimmed || codeDefault;

  try {
    const { data, error } = await supabase
      .from("photo_app_config")
      .select("value")
      .eq("key", configKey)
      .maybeSingle();

    if (error) {
      console.warn(`[vibe.config] photo_app_config read failed (${logLabel})`, {
        key: configKey,
        message: error.message,
      });
      return fallbackModel;
    }

    const v = data?.value;
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v).trim();
    }
  } catch (err) {
    console.warn(`[vibe.config] photo_app_config read threw (${logLabel})`, {
      key: configKey,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  return fallbackModel;
}

/** Resolved model for extract: `photo_app_config.vibe_extract_model` → env → default Pro. */
export async function getGeminiVibeExtractModelRuntime(
  supabase: ReturnType<typeof createSupabaseServer>
): Promise<string> {
  return getVibeModelStringFromPhotoAppConfig(
    supabase,
    PHOTO_APP_CONFIG_KEY_VIBE_EXTRACT_MODEL,
    "GEMINI_VIBE_EXTRACT_MODEL",
    DEFAULT_GEMINI_VIBE_EXTRACT_MODEL,
    "extract"
  );
}

/** Resolved model for expand: `photo_app_config.vibe_expand_model` → env → default Flash. */
export async function getGeminiVibeExpandModelRuntime(
  supabase: ReturnType<typeof createSupabaseServer>
): Promise<string> {
  return getVibeModelStringFromPhotoAppConfig(
    supabase,
    PHOTO_APP_CONFIG_KEY_VIBE_EXPAND_MODEL,
    "GEMINI_VIBE_EXPAND_MODEL",
    DEFAULT_GEMINI_VIBE_EXPAND_MODEL,
    "expand"
  );
}

function parseVibeLlmProvider(value: string | null | undefined, fallback: "gemini" | "openai"): "gemini" | "openai" {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "openai") return "openai";
  if (raw === "gemini") return "gemini";
  return fallback;
}

/**
 * Source of truth: `photo_app_config.vibe_extract_llm` (`gemini` | `openai`). Fallback: env `VIBE_EXTRACT_LLM`, default **gemini**.
 */
export async function getVibeExtractLlmProvider(
  supabase: ReturnType<typeof createSupabaseServer>
): Promise<"gemini" | "openai"> {
  const envFallback = parseVibeLlmProvider(process.env.VIBE_EXTRACT_LLM, "gemini");

  try {
    const { data, error } = await supabase
      .from("photo_app_config")
      .select("value")
      .eq("key", PHOTO_APP_CONFIG_KEY_VIBE_EXTRACT_LLM)
      .maybeSingle();

    if (error) {
      console.warn("[vibe.config] photo_app_config read failed", {
        key: PHOTO_APP_CONFIG_KEY_VIBE_EXTRACT_LLM,
        message: error.message,
      });
      return envFallback;
    }

    const v = data?.value;
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return parseVibeLlmProvider(String(v), envFallback);
    }
  } catch (err) {
    console.warn("[vibe.config] photo_app_config read threw", {
      key: PHOTO_APP_CONFIG_KEY_VIBE_EXTRACT_LLM,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  return envFallback;
}

/**
 * Source of truth: `photo_app_config.vibe_expand_llm` (`gemini` | `openai`). Fallback: env `VIBE_EXPAND_LLM`, default **gemini**.
 */
export async function getVibeExpandLlmProvider(
  supabase: ReturnType<typeof createSupabaseServer>
): Promise<"gemini" | "openai"> {
  const envFallback = parseVibeLlmProvider(process.env.VIBE_EXPAND_LLM, "gemini");

  try {
    const { data, error } = await supabase
      .from("photo_app_config")
      .select("value")
      .eq("key", PHOTO_APP_CONFIG_KEY_VIBE_EXPAND_LLM)
      .maybeSingle();

    if (error) {
      console.warn("[vibe.config] photo_app_config read failed", {
        key: PHOTO_APP_CONFIG_KEY_VIBE_EXPAND_LLM,
        message: error.message,
      });
      return envFallback;
    }

    const v = data?.value;
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return parseVibeLlmProvider(String(v), envFallback);
    }
  } catch (err) {
    console.warn("[vibe.config] photo_app_config read threw", {
      key: PHOTO_APP_CONFIG_KEY_VIBE_EXPAND_LLM,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  return envFallback;
}

/** OpenAI chat model for extract when `vibe_extract_llm` = openai. */
export async function getOpenAiVibeExtractModelRuntime(
  supabase: ReturnType<typeof createSupabaseServer>
): Promise<string> {
  return getVibeModelStringFromPhotoAppConfig(
    supabase,
    PHOTO_APP_CONFIG_KEY_VIBE_OPENAI_EXTRACT_MODEL,
    "VIBE_OPENAI_EXTRACT_MODEL",
    DEFAULT_OPENAI_VIBE_EXTRACT_MODEL,
    "openai-extract"
  );
}

/** OpenAI chat model for expand when `vibe_expand_llm` = openai. */
export async function getOpenAiVibeExpandModelRuntime(
  supabase: ReturnType<typeof createSupabaseServer>
): Promise<string> {
  return getVibeModelStringFromPhotoAppConfig(
    supabase,
    PHOTO_APP_CONFIG_KEY_VIBE_OPENAI_EXPAND_MODEL,
    "VIBE_OPENAI_EXPAND_MODEL",
    DEFAULT_OPENAI_VIBE_EXPAND_MODEL,
    "openai-expand"
  );
}

export const EXTRACT_STYLE_INSTRUCTION = `
Analyze this reference image and extract every visual detail needed to recreate this exact scene with a different person. The output will guide an AI image generation model — be extremely specific and concrete.

Note: The JSON describes THIS reference shot only (including this model's hair, eyes, skin in palette/expression where visible). A later step swaps in the end user's face. Accurate reference documentation is good; identity transfer is handled separately — do not omit real details from the photo.

Return a JSON object with these exact fields:
MANDATORY: Core string fields (scene, genre, subject_pose, expression, hair_makeup, lighting, camera, mood, composition) must be non-empty. Never use "" for camera or composition — estimate focal length, angle, framing, and placement from the image if unsure.

- scene: What is happening in this image. Describe the setting, action, time of day, and spatial context in 2-3 sentences, AND one sentence on overall vibe/energy (confident, vulnerable, playful, editorial cool, candid warmth) plus how the pose reads (open vs guarded, relaxed vs tense). Example: "A woman lying on a bed of white crumpled sheets, taking a selfie from above. Morning light fills the room. The frame is intimate and close. The vibe is soft, unhurried, and inviting — body language reads fully relaxed and trusting."
- genre: The photographic genre and substyle. Examples: "intimate lifestyle portrait", "high-fashion editorial", "candid street photography", "cozy bedroom selfie".
- subject_pose: CRITICAL FIELD — one dense paragraph (or two short sentences) that a director could shoot from, covering ALL of the below that apply. Do NOT substitute a generic "classic frontal portrait" or "facing straight to camera" or "neutral head" if the photo shows ANY torso turn, shoulder asymmetry, or head tilt — describe the REAL geometry.
  REQUIRED ANCHORS (use explicit viewer/subject directions): (1) Torso vs camera: square-on, slight quarter-turn, or three-quarter; estimate degrees if helpful (~10–30°). (2) Which shoulder is CLOSER to the camera — say both "subject's left/right" AND "viewer's left/right" once each to avoid ambiguity. (3) Head relative to torso: tilt TOWARD which shoulder (ear dropping that way)? Or vertical? Neck extension or compression? (4) Face vs lens: full face, three-quarter, or profile — even if eyes look into the lens, the chin/nose line may still be off-axis; say so. (5) Chin height: raised, neutral, or tucked. (6) Shoulder line: level or one raised/forward. (7) Gaze: into camera, past camera, down — consistent with head pose. (8) Arms/hands if visible; if cropped out, say "hands out of frame". (9) Legs/feet if visible; else omit. (10) Weight / lean: obvious shift forward, back, or hip pop if visible.
  FORBIDDEN: Replacing an asymmetric or angled reference with a symmetric "straight-on" description. If unsure, choose the more specific asymmetric reading that matches the photo.
  Example (studio bust, angled): "Bust crop; torso rotated ~15° so subject's left shoulder sits slightly closer to camera (viewer's right); head tilted toward subject's right shoulder while eyes still engage the lens; chin neutral; shoulder line subtly uneven; hands out of frame."
  Example (bed selfie): "Lying on back, head on pillow tilted slightly left, right arm extended up holding phone for overhead selfie, left hand resting near face, relaxed body language, legs slightly bent under sheets."
- expression: The precise facial expression and emotional state. Not just "smiling" — describe the quality: "soft relaxed half-smile, slightly parted lips, heavy-lidded dreamy eyes looking directly into camera with quiet confidence." Include micro-details: teeth showing or not, eyebrow position, eye squint level.
- hair_makeup: BEAUTY TRANSFER (critical for vibe match) — one dense paragraph the image model can follow to make the USER look groomed like THIS shoot, not like their raw upload. Cover HAIR STYLING: part, root volume, wave/curl/sleek/pulled-back/bun/braid, flyaways, fringe/bangs behavior, shine vs matte, visible hair accessories. Cover MAKEUP: base finish (dewy/matte/skin-like), blush/contour level, brow shape/grooming, eye makeup (liner, shadow shape, lashes, waterline), lip shape/color/finish (gloss/satin/matte). Rules: document the REFERENCE look precisely, but phrase so a different person keeps their own bone structure — e.g. "smoky bronze shadow in a soft wing, nude-rose satin lip" not "copy model X's face." Natural hair COLOR stays the user's in a later step; here you specify STYLING and finish only.
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
For subject_pose and composition: preserve asymmetry from the photo — never "normalize" a slightly turned torso or tilted head into a textbook frontal headshot unless the reference is genuinely square and frontal.
Return ONLY valid JSON, no markdown.
`.trim();

/** Placed immediately BEFORE the reference inline image in the multi-part request. */
export const VIBE_IMAGE_PART_LABEL_REFERENCE = `
[IMAGE A — STYLE REFERENCE ONLY]
The NEXT part is a photograph used ONLY as a recipe: pose, lighting, wardrobe style, hair styling, makeup/beauty look, background, camera, color grade, mood.
It is NOT the person to depict in the output. Do NOT copy this person's face, bone structure, skin, eyes, or hair color as the result identity.
`.trim();

/** Placed immediately BEFORE the user's photo inline image(s). */
export const VIBE_IMAGE_PART_LABEL_SUBJECT = `
[IMAGE B — SUBJECT / USER IDENTITY]
The NEXT part is the ONLY source for who the person in the output must be. The output face MUST match this person (same identity).
Re-style hair and apply makeup to match IMAGE A's groomed look — the person must NOT look like an unchanged snapshot from B; only identity (bone structure, natural hair color) stays from B.
If the result looks like IMAGE A's model, you FAILED — redo mentally until the face matches IMAGE B.
`.trim();

/**
 * Prepended when generate-process attaches reference + user (interleaved labels + images + text).
 */
export const GENERATE_VIBE_PREFIX_TWO_IMAGES = `
CRITICAL INSTRUCTIONS — read carefully before the prompt.

REQUEST LAYOUT (multi-part message):
1) A short text label, then IMAGE A — the STYLE REFERENCE photograph (pose, light, set, wardrobe, hair styling, makeup, camera, color grade, mood).
2) A short text label, then IMAGE B — the SUBJECT / USER (the only source for who the person in the output must be).

YOUR TASK: Create a NEW photorealistic image where the person from IMAGE B is placed into a scene that recreates the look, feel, and atmosphere of IMAGE A — as if B had been photographed in that same shoot. Not a lazy crop of B's selfie. Not a face-swap onto A.

IDENTITY (from IMAGE B — preserve exactly):
- Face structure, bone structure, facial features, skin tone, eye color and shape, brows, nose, lips, ears, apparent age
- Body proportions and build
- Natural hair color and texture (do not recolor B to match A's hair) — but you MUST visibly restyle (part, volume, waves/sleek/updo) to match A's salon/editorial hair look

STYLE & SCENE (from IMAGE A + the text below — apply onto B):
- Pose, body position, and body language — match IMAGE A, NOT B's original pose in their upload
- Hair STYLING and arrangement — aggressively adapt B's hair to A's reference look (part, root lift, waves/curls/sleek pull-back, flyaways, accessories). The head must read as "same shoot as A", not B's everyday hair.
- Makeup / beauty — match A's cosmetic look on B's face (eye makeup shape, lip finish, skin finish, contour/blush level). Do not leave B bare-faced if A is clearly made up.
- Facial expression mood and performance from the reference (smile quality, gaze intensity) while keeping B recognizable
- Environment, setting, surfaces, props, background
- Lighting: direction, quality, color temperature, shadow pattern
- Color grading, contrast, saturation, palette of the shot
- Clothing: style, fabrics, colors, fit — worn naturally on B's body
- Camera: angle, framing, composition, depth of field, lens feel

The result must look like B was ACTUALLY PHOTOGRAPHED in that reference scene — natural integration, not composited or pasted.

Output must be a single seamless photograph — one coherent frame. FORBIDDEN: tiling, side-by-side panels, vertical/horizontal stitching, collage, diptych, or any composition that looks like two photos glued together. Do not paste B's face as a cutout on top of A.

The text prompt below adds director-level specificity — treat pose, body line, hair/makeup grooming, and overall vibe as mandatory to match IMAGE A; then light, wardrobe, set, and grade. Follow it precisely. Never let prose describing "the model in the reference" override IMAGE B's identity.

`.trimStart();

/**
 * When `vibe_one_shot_extract_prompt` is on: same as {@link GENERATE_VIBE_PREFIX_TWO_IMAGES} but without the
 * “single seamless photograph / FORBIDDEN tiling…” block (one-shot scene prompt already encodes integration).
 */
export const GENERATE_VIBE_PREFIX_TWO_IMAGES_ONE_SHOT = `
CRITICAL INSTRUCTIONS — read carefully before the prompt.

REQUEST LAYOUT (multi-part message):
1) A short text label, then IMAGE A — the STYLE REFERENCE photograph (pose, light, set, wardrobe, hair styling, makeup, camera, color grade, mood).
2) A short text label, then IMAGE B — the SUBJECT / USER (the only source for who the person in the output must be).

YOUR TASK: Create a NEW photorealistic image where the person from IMAGE B is placed into a scene that recreates the look, feel, and atmosphere of IMAGE A — as if B had been photographed in that same shoot. Not a lazy crop of B's selfie. Not a face-swap onto A.

IDENTITY (from IMAGE B — preserve exactly):
- Face structure, bone structure, facial features, skin tone, eye color and shape, brows, nose, lips, ears, apparent age
- Body proportions and build
- Natural hair color and texture (do not recolor B to match A's hair) — but you MUST visibly restyle (part, volume, waves/sleek/updo) to match A's salon/editorial hair look

STYLE & SCENE (from IMAGE A + the text below — apply onto B):
- Pose, body position, and body language — match IMAGE A, NOT B's original pose in their upload
- Hair STYLING and arrangement — aggressively adapt B's hair to A's reference look (part, root lift, waves/curls/sleek pull-back, flyaways, accessories). The head must read as "same shoot as A", not B's everyday hair.
- Makeup / beauty — match A's cosmetic look on B's face (eye makeup shape, lip finish, skin finish, contour/blush level). Do not leave B bare-faced if A is clearly made up.
- Facial expression mood and performance from the reference (smile quality, gaze intensity) while keeping B recognizable
- Environment, setting, surfaces, props, background
- Lighting: direction, quality, color temperature, shadow pattern
- Color grading, contrast, saturation, palette of the shot
- Clothing: style, fabrics, colors, fit — worn naturally on B's body
- Camera: angle, framing, composition, depth of field, lens feel

The result must look like B was ACTUALLY PHOTOGRAPHED in that reference scene — natural integration, not composited or pasted.

The text prompt below adds director-level specificity — treat pose, body line, hair/makeup grooming, and overall vibe as mandatory to match IMAGE A; then light, wardrobe, set, and grade. Follow it precisely. Never let prose describing "the model in the reference" override IMAGE B's identity.

`.trimStart();

export const GENERATE_VIBE_PREFIX_SINGLE_IMAGE = `
CRITICAL INSTRUCTIONS — read carefully before the prompt.

The attached photo shows the SUBJECT — a real person whose identity must be preserved.
Your task is to CREATE ONE NEW photorealistic image of this person placed into the scene described below.

PRESERVE exactly: face structure, facial features, skin tone, eye color, body proportions, natural hair color (do not dye to match a reference model).
CHANGE to match the description: pose, body position, clothing, hairstyle STYLING (part, volume, texture, updo/waves/sleek — must look visibly restyled vs the raw upload), makeup and skin finish as described, environment, lighting, color grading, camera angle, expression.

The paragraph below was written from a style JSON about a reference shoot. If it mentions hair/eyes/skin of "another" model, ignore that for identity — use ONLY the attached photo for who the person is. Still follow that text for pose, light, wardrobe, hair styling, makeup, set, and grade.

Output must be a single seamless photograph — one coherent frame. FORBIDDEN: tiling, side-by-side panels, vertical/horizontal stitching, collage, or any composition that looks like two photos glued together. Do not paste the subject onto a strip of another image.

The person must look like they were ACTUALLY PHOTOGRAPHED in the described setting — natural, realistic, belonging to the scene. Not composited or pasted.

Director scene — follow pose, framing, light, vibe, hair styling, and makeup below precisely (identity stays from the attached photo):

`.trimStart();

/**
 * When `vibe_one_shot_extract_prompt` is on: drops PRESERVE/CHANGE, “style JSON” disclaimer, and seamless/collage FORBIDDEN block
 * (one-shot extract prompt already states identity + integration).
 */
export const GENERATE_VIBE_PREFIX_SINGLE_IMAGE_ONE_SHOT = `
CRITICAL INSTRUCTIONS — read carefully before the prompt.

The attached photo shows the SUBJECT — a real person whose identity must be preserved.
Your task is to CREATE ONE NEW photorealistic image of this person placed into the scene described below.

GROOMING: The scene text will specify hair styling and makeup from a reference shoot — apply them fully on this person's face and hair. The output must look like a professional reshoot, NOT like the user's casual upload with only a new background.

The person must look like they were ACTUALLY PHOTOGRAPHED in the described setting — natural, realistic, belonging to the scene. Not composited or pasted.

Director scene — follow pose, framing, light, vibe, hair, and makeup below precisely (identity stays from the attached photo):

`.trimStart();

/** Bridge only for dual-image requests (after TWO_IMAGES prefix, before expanded prose). */
export const GENERATE_VIBE_JSON_IDENTITY_BRIDGE_DUAL = `

JSON-TO-SCENE REMINDER: The detailed prompt below was expanded from a style JSON about the REFERENCE shoot. Any hair/eye/skin/face wording there describes IMAGE A's model — IGNORE for identity. The ONLY identity source is IMAGE B (the user photo, after its [IMAGE B] label). Transfer pose, light, set, clothes, grade, mood from the text onto B's face. Explicitly transfer hair_makeup / grooming cues from the text onto B: restyle hair and apply makeup like the reference — B must look groomed for the same shoot, not unchanged from their selfie.

`;

/**
 * Expand step: tells Gemini whether image-gen will attach reference pixels.
 */
export function buildVibeExpandRuntimeContext(willAttachReferenceInline: boolean): string {
  if (willAttachReferenceInline) {
    return `
RUNTIME CONTEXT (do not repeat this label in your JSON; use it only for phrasing):
The image generation step will receive TWO inputs in order: first the REFERENCE photo (IMAGE A — style anchor), then the USER photo (IMAGE B — identity). The model sees both pixels — your prompt adds director-level detail (blocking, textures, micro-expression, hair_makeup). Strongly align pose, framing, lighting, hair styling, and makeup with what IMAGE A shows; the face must remain the user from IMAGE B.
`.trim();
  }
  return `
RUNTIME CONTEXT:
The image generation API receives ONLY the USER photograph plus your text — reference / Pinterest image pixels are not sent to the image model. The style JSON is the sole recipe for the reference look: spell out pose, hands, head tilt, gaze, wardrobe, set, light, and the hair_makeup field (salon hair + makeup) with maximum precision so the model visibly restyles the user — not just pastes them unchanged into the scene.
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

/**
 * Source of truth: `photo_app_config.vibe_one_shot_extract_prompt`. Fallback: env `VIBE_ONE_SHOT_EXTRACT_PROMPT`, default **false**.
 */
export async function getVibeOneShotExtractPromptEnabled(
  supabase: ReturnType<typeof createSupabaseServer>
): Promise<boolean> {
  const envFallback = parseBoolConfigValue(process.env.VIBE_ONE_SHOT_EXTRACT_PROMPT, false);

  try {
    const { data, error } = await supabase
      .from("photo_app_config")
      .select("value")
      .eq("key", PHOTO_APP_CONFIG_KEY_VIBE_ONE_SHOT_EXTRACT_PROMPT)
      .maybeSingle();

    if (error) {
      console.warn("[vibe.config] photo_app_config read failed", {
        key: PHOTO_APP_CONFIG_KEY_VIBE_ONE_SHOT_EXTRACT_PROMPT,
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
      key: PHOTO_APP_CONFIG_KEY_VIBE_ONE_SHOT_EXTRACT_PROMPT,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  return envFallback;
}

/**
 * Single Gemini vision call: reference image → final scene prompt text (same role as extract+expand).
 * Output JSON: { "prompt": "..." } only.
 */
export const ONE_SHOT_EXTRACT_PROMPT_INSTRUCTION = `
You are an expert vision analyst and prompt engineer for photorealistic AI image generation.

You see ONE reference photograph (Pinterest / editorial / selfie). A later step will place a DIFFERENT real person (the end user) into this scene — their face, skin, eyes, hair color, and bone structure must come ONLY from the user's photo, not from the reference model.

Your task in THIS step: write ONE rich English scene prompt that an image model can follow together with the user's photo. The prompt must transfer pose, lighting, wardrobe, environment, camera, color grade, mood, salon-level hair styling, and makeup / skin finish from the reference — with the same precision as a two-step pipeline (structured analysis + expansion). The user's face and natural hair color stay theirs, but the result must look groomed like the reference shoot, not like an unchanged casual upload.

POSE & BODY (highest priority): Before light or wardrobe, lock geometry like a director. Include: torso vs camera (square-on / quarter-turn / three-quarter; ~degrees if useful); which shoulder is closer (state BOTH subject's left/right AND viewer's left/right once); head tilt toward which shoulder or vertical; chin height; face vs lens (full / three-quarter / profile) even if eyes hit the lens; shoulder line level or uneven; weight on hips/feet or where the body leans; spine line and any twist; arms/hands (or "hands out of frame"); legs/feet if visible; micro-gestures and tension vs relaxation. Do NOT replace an asymmetric reference with a generic "straight-on portrait".

VIBE / ATMOSPHERE: After pose, explicitly carry genre + emotional temperature + viewer relationship (intimate / editorial / voyeuristic / heroic / candid) so the shot "feels" like the reference, not just looks lit similarly.

COVER in flowing prose (not a bullet list), woven together (pose+vibe first, then grooming, then the rest):
- Expression: micro-details (mouth, eyes, brows) tied to the pose
- HAIR: reference-accurate styling (part, volume, texture, updo/waves/sleek, flyaways, accessories) on the subject's natural hair color — must read as visibly restyled, not "same as upload"
- MAKEUP: eye look, brows, lip color/finish, base (dewy/matte), blush/contour — match the reference glam level
- Camera: focal length estimate, angle, distance, depth of field, framing
- Lighting: direction, quality, color temperature, shadows — always anchored in space (e.g. window camera-left)
- Environment, clothing, color grading, props/jewelry/background anchors — rephrase reference-only face/hair/eye/skin biometrics as transferable cues ("the subject's natural eye color", etc.)

Rules:
1. Start the prompt with exactly: "Place the person from the attached photo into this scene:"
2. In the sentences immediately after that opening, dedicate ~35–45% of the total word count to pose + body language + overall vibe before deep lighting/grade detail; include a dedicated clause (~60–110 words) on hair styling + makeup before or woven with wardrobe.
3. Length: 220–420 words, one or two short paragraphs.
4. No vague "natural lighting" or "relaxed pose" without concrete placement and geometry.
5. Remind that facial identity must match the user's attached photo only.
6. Forbidden: describing the person as if they still look like a bare-faced / everyday-hair snapshot when the reference is clearly styled.

Return ONLY valid JSON (not markdown):
{ "prompt": "..." }
`.trim();

export const EXPAND_PROMPTS_INSTRUCTION = `
You are an expert prompt engineer for photorealistic AI image generation. Your task: turn a style JSON (extracted from a REFERENCE photo) into ONE rich scene prompt for a DIFFERENT person (the end user's face will come from their attached photograph).

The JSON documents the reference shoot. The OUTPUT must depict the USER's real identity (face, skin tone, eye color, hair color, bone structure) — not the reference model's face. Transfer the SCENE: pose, light, wardrobe, hair_makeup (grooming), environment, camera, grade, mood. The user must look restyled — not pasted unchanged from their upload.

Generate exactly ONE prompt. Structure the prose for an image model: right after the required opening sentence, spend the next ~35–45% of words on dense POSE + BODY LANGUAGE from subject_pose (preserve viewer/subject left-right shoulder language if JSON has it; include weight, spine line, hands, gaze vs head axis). Then weave expression + vibe (genre + mood + viewer relationship from genre/mood/scene). Then dedicate clear prose from hair_makeup (salon hair + makeup on the user's features, natural hair color retained). Only then layer camera, environment, wardrobe, lighting, and color grade. Do not bury pose in the closing sentences — if subject_pose is long, you may use two paragraphs: first = pose+expression+vibe+hair_makeup, second = camera+environment+light+wardrobe+grade+key details.

THE PROMPT MUST COVER ALL of these (woven into prose, not as a markdown list):
1. SUBJECT POSE — from subject_pose: full blocking — torso rotation, shoulders (which closer to camera), head tilt, chin, gaze vs lens, arms/hands, legs if relevant, weight/lean. Highest priority; director-level, not a summary.
2. EXPRESSION — from expression: micro-details (smile type, lips, eyes, brows) consistent with the pose.
3. VIBE GLUE — from scene + genre + mood: one coherent "feel" (energy, intimacy vs distance, editorial vs candid) so the reference's attitude is obvious.
4. HAIR & MAKEUP — from hair_makeup: explicit transferable styling (part, volume, texture, finish) and cosmetic look on the USER's face; never skip — if the reference is bare-faced / natural hair, say so explicitly; if glam, spell it out. Natural hair color stays the user's.
5. CAMERA — from camera + composition: focal length, angle, distance, depth of field, framing, subject placement.
6. LIGHTING — from lighting: direction, quality, temperature, shadows, sources.
7. ENVIRONMENT — from environment: surfaces, textures, props and positions.
8. CLOTHING — from clothing: garments, fabrics, fit, accessories (wardrobe on the user).
9. COLOR GRADING — from color_grading + color_palette: concrete photographic look (shadow/highlight tint, saturation, contrast). Rephrase palette terms as light and set (e.g. "warm rim on hair", "sage wall") without assigning the reference model's hair/eye/skin colors as the user's identity.
10. KEY DETAILS — rewrite each key_detail into a transferable anchor for the USER: keep composition/light/prop/jewelry/fabric beats, but strip or generalize ANY reference-only biometrics (eye color, hair color, skin tone, face shape, "emerald eyes", "long dark hair", etc.). Never quote key_details verbatim if they describe the reference model's face or body — rephrase as "intense direct gaze with the subject's natural eye color", "hair styled with a braid using the subject's natural hair color and length", etc.

Rules:
1. Start the prompt with: "Place the person from the attached photo into this scene:"
2. Length: 220–420 words in one continuous paragraph or two short paragraphs (use two if needed to keep pose detail early).
3. NEVER vague phrases like "natural lighting" or "warm tones" or "relaxed pose" without saying exactly where and how (geometry, direction, quality).
4. Remind at least once that facial identity must match the attached user/subject photo only.
5. Forbidden: output that could be read as "same hair and face finish as the casual user photo" when hair_makeup describes a styled reference look.

Return ONLY a valid JSON object (not an array):
{ "prompt": "..." }
`.trim();

/**
 * Full text sent to Gemini image generation for vibe rows (must match generate-process).
 * `assumeReferenceImageLoaded`: true only when reference inline image is actually attached
 * (or, in expand preview, when we intend to attach and have source_image_url).
 * `oneShotExtractConfigEnabled`: when `photo_app_config.vibe_one_shot_extract_prompt` is true — shorter prefixes
 * (no duplicate PRESERVE/JSON disclaimer/seamless-FORBIDDEN blocks; dual path also skips JSON identity bridge).
 */
export function assembleVibeFinalPrompt(
  rawExpandedPrompt: string,
  assumeReferenceImageLoaded = false,
  oneShotExtractConfigEnabled = false
): string {
  if (assumeReferenceImageLoaded) {
    if (oneShotExtractConfigEnabled) {
      return GENERATE_VIBE_PREFIX_TWO_IMAGES_ONE_SHOT + rawExpandedPrompt;
    }
    return GENERATE_VIBE_PREFIX_TWO_IMAGES + GENERATE_VIBE_JSON_IDENTITY_BRIDGE_DUAL + rawExpandedPrompt;
  }
  if (oneShotExtractConfigEnabled) {
    return GENERATE_VIBE_PREFIX_SINGLE_IMAGE_ONE_SHOT + rawExpandedPrompt;
  }
  return GENERATE_VIBE_PREFIX_SINGLE_IMAGE + rawExpandedPrompt;
}
