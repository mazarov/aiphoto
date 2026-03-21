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
Analyze this reference image for an AI image model that will recreate the scene with a different person. Be specific and concrete.

The JSON describes THIS reference only; a later step swaps in the end user's face. Do not omit visible reference details; identity transfer is handled downstream.

Return a JSON object with these exact fields:
MANDATORY non-empty strings: scene, genre, subject_pose, expression, hair_makeup, lighting, camera, mood, composition. Never use "" for camera or composition — estimate from the image if unsure.

- scene: Setting, action, time, spatial context (2–3 sentences) + one sentence on vibe/energy and how the pose reads (open/guarded, relaxed/tense).
- genre: Photographic genre/substyle (e.g. lifestyle portrait, editorial, street, selfie).
- subject_pose: CRITICAL — one dense paragraph a director could shoot from. Do NOT substitute generic "straight to camera" / "neutral head" if the photo has torso turn, shoulder asymmetry, or head tilt.
  ANCHORS (viewer + subject directions): (1) Torso vs camera: square-on / quarter / three-quarter (~degrees). (2) Which shoulder is CLOSER — state subject's left/right AND viewer's left/right once each. (3) Head vs torso: tilt toward which shoulder or vertical; neck extension/compression. (4) Face vs lens: full / three-quarter / profile (chin-nose line may be off-axis even if eyes hit lens). (5) Chin: raised / neutral / tucked. (6) Shoulder line: level or uneven. (7) Gaze vs head. (8) Arms/hands or "hands out of frame". (9) Legs/feet if visible. (10) Weight/lean/hip if visible.
  FORBIDDEN: symmetric "straight-on" when the photo is asymmetric. If unsure, prefer the more specific asymmetric reading.
  Examples: (studio) "Bust crop; torso ~15° so subject's left shoulder closer (viewer's right); head tilt toward subject's right shoulder, eyes to lens; chin neutral; uneven shoulders; hands OOF." (bed) "On back, head on pillow tilted left, right arm up with phone for overhead selfie, left hand near face, legs bent under sheets."
- expression: Precise expression and emotion — quality of smile, lips, brows, eyes, squint; not just "smiling".
- hair_makeup: BEAUTY TRANSFER — one paragraph: hair STYLING (part, volume, texture, updo/waves, flyaways, shine/matte, accessories) + MAKEUP (base, blush/contour, brows, eyes, lips). Phrase for transfer to another face; natural hair COLOR stays the user's later. Do NOT put pose/head turn here — subject_pose only.
- lighting: Direction, quality, color temp (K or words), shadow depth, named sources.
- camera: Focal length band, DoF, angle, distance (crop), tilt.
- mood: 2–3 sentences — feeling, story, viewer relationship to subject.
- color_palette: 4–6 named colors + warm/cool harmony (or "").
- color_grading: Contrast, saturation, shadow/highlight tint, film/filter feel (or "").
- clothing: Garments, fabrics, fit, accessories; visible coverage. "" if N/A.
- environment: Background materials, props, positions, indoor/outdoor. "" if empty.
- composition: Framing, placement, negative space, lines, symmetry, aspect feel.
- key_details: Array 3–5 distinctive anchors for the vibe; if not a plain frontal bust, include ≥1 pose/composition anchor (diagonal torso, foreshortened arm, asymmetry). Strip later to transferable wording in expand.

Be precise — no vague "natural" or "warm tones" without concrete geometry, direction, or texture. Preserve asymmetry in subject_pose and composition unless the reference is truly frontal.
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
Ignore B's original pose, head tilt, and camera angle when they conflict with IMAGE A — B is an identity plate, not a blocking reference. Re-pose the body and head to match A's geometry.
`.trim();

/** Shared body for dual-image vibe prefixes (two-shot adds {@link GENERATE_VIBE_PREFIX_TWO_IMAGES_SEAMLESS} before closing). */
const GENERATE_VIBE_PREFIX_TWO_IMAGES_CORE = `
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
- Pose, body position, and body language — match IMAGE A, NOT B's original pose in their upload. If B's selfie is frontal but A is three-quarter (or vice versa), the OUTPUT must follow A — rotate B's head and shoulders accordingly while keeping B's face recognizable.
- Hair STYLING and arrangement — aggressively adapt B's hair to A's reference look (part, root lift, waves/curls/sleek pull-back, flyaways, accessories). The head must read as "same shoot as A", not B's everyday hair. Grooming describes finish and styling only — it does NOT override torso/head angle from IMAGE A or from the scene text.
- Makeup / beauty — match A's cosmetic look on B's face (eye makeup shape, lip finish, skin finish, contour/blush level). Do not leave B bare-faced if A is clearly made up.
- Facial expression mood and performance from the reference (smile quality, gaze intensity) while keeping B recognizable
- Environment, setting, surfaces, props, background
- Lighting: direction, quality, color temperature, shadow pattern
- Color grading, contrast, saturation, palette of the shot
- Clothing: style, fabrics, colors, fit — worn naturally on B's body
- Camera: angle, framing, composition, depth of field, lens feel

The result must look like B was ACTUALLY PHOTOGRAPHED in that reference scene — natural integration, not composited or pasted.

`.trim();

const GENERATE_VIBE_PREFIX_TWO_IMAGES_SEAMLESS = `
Output must be a single seamless photograph — one coherent frame. FORBIDDEN: tiling, side-by-side panels, vertical/horizontal stitching, collage, diptych, or any composition that looks like two photos glued together. Do not paste B's face as a cutout on top of A.

`;

const GENERATE_VIBE_PREFIX_TWO_IMAGES_CLOSING = `
The text prompt below adds director-level specificity — treat pose, body line, hair/makeup grooming, and overall vibe as mandatory to match IMAGE A; then light, wardrobe, set, and grade. Follow it precisely. Never let prose describing "the model in the reference" override IMAGE B's identity.

`.trim();

/**
 * Prepended when generate-process attaches reference + user (interleaved labels + images + text).
 */
export const GENERATE_VIBE_PREFIX_TWO_IMAGES =
  `${GENERATE_VIBE_PREFIX_TWO_IMAGES_CORE}${GENERATE_VIBE_PREFIX_TWO_IMAGES_SEAMLESS}${GENERATE_VIBE_PREFIX_TWO_IMAGES_CLOSING}`.trimStart();

/**
 * When `vibe_one_shot_extract_prompt` is on: shared dual-image core without the seamless/collage block (one-shot scene text already covers integration).
 */
export const GENERATE_VIBE_PREFIX_TWO_IMAGES_ONE_SHOT =
  `${GENERATE_VIBE_PREFIX_TWO_IMAGES_CORE}${GENERATE_VIBE_PREFIX_TWO_IMAGES_CLOSING}`.trimStart();

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

JSON-TO-SCENE: The prose below describes the REFERENCE shoot — any face/hair/skin biometrics there are IMAGE A only; identity is IMAGE B only. Apply pose, light, set, wardrobe, grade, mood, and grooming from the text onto B (restyled hair/makeup, not B's casual selfie). Blocking in the text beats B's upload pose; grooming is beauty only, not head/torso angle.

`;

/** Appended after the director scene text so image models re-attend to geometry vs identity. */
export const GENERATE_VIBE_TRAILING_POSE_LOCK_DUAL = `
POSE LOCK: Match IMAGE A's torso, nearer shoulder, head tilt, chin, and face plane (full / three-quarter / profile) on B's body — do not keep B's selfie angle when it conflicts. No generic frontal unless A is frontal. Identity from B; geometry from A.
`.trim();

/** Single-image vibe path: reinforce pose from text vs casual upload. */
export const GENERATE_VIBE_TRAILING_POSE_LOCK_SINGLE = `
POSE LOCK: Follow the scene text's blocking and head angle — do not revert to the attached photo's casual pose if the text specifies a different turn or asymmetry.
`.trim();

/**
 * Expand step: tells Gemini whether image-gen will attach reference pixels.
 */
export function buildVibeExpandRuntimeContext(willAttachReferenceInline: boolean): string {
  if (willAttachReferenceInline) {
    return `
RUNTIME (do not echo this label in JSON): Image-gen gets IMAGE A then B. Align pose/framing/light/grooming with A; face = B only. Copy subject_pose fully in "prompt"; put hair/makeup in grooming.* only — never let grooming replace blocking.
`.trim();
  }
  return `
RUNTIME: Image-gen sees ONLY the user photo + your text — no reference pixels. Spell out subject_pose in full (no summary → no default frontal). hair_makeup → grooming.*; do not trade explicit head/torso angles for long beauty prose.
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
 * Single Gemini vision call: reference image → scene + grooming JSON (same role as extract+expand).
 * Output JSON: { "prompt", "grooming": { "hair", "makeup" } }.
 */
export const ONE_SHOT_EXTRACT_PROMPT_INSTRUCTION = `
You analyze ONE reference photo for photorealistic image generation. A different real person (user) will be placed into this scene — their face, skin, eyes, hair color, bone structure come ONLY from the user's photo later.

Output JSON: "prompt" = scene-only English prose; "grooming" = transferable hair + makeup for the user's natural hair color. Match the reference shoot like a two-step extract+expand pipeline.

Inside "prompt" (priority order): (1) POSE/BODY first — director-level geometry: torso vs camera, which shoulder closer (subject + viewer sides), head tilt, chin, face vs lens (full/¾/profile even if eyes hit lens), shoulders, weight/lean, spine twist, arms/hands or "hands OOF", legs if visible. No generic "straight-on" if the photo is asymmetric. (2) Vibe (genre, energy, viewer relationship). (3) Expression tied to pose. (4) Camera, concrete lighting, environment, clothing, grade — rephrase reference biometrics as transferable ("subject's natural eye color"). Long hair/makeup prose lives ONLY in grooming.*.

"grooming.hair" / "grooming.makeup": full reference styling; "" only if invisible / bare / unstyled.

Rules:
1. Start "prompt" with exactly: "Place the person from the attached photo into this scene:"
2. ~35–45% of "prompt" words = pose + body + vibe before deep light/grade; no long hair/makeup in "prompt".
3. Total "prompt" ~220–420 words (with grooming, scene is complete for image-gen).
4. No vague lighting/pose — always concrete geometry and direction.
5. State in "prompt" that identity must match the user's photo only; if reference is styled, do not describe the subject as bare-faced/everyday-hair (use grooming).
6. On conflict: blocking in "prompt" wins; grooming never contradicts head/torso angles.

Return ONLY valid JSON (not markdown):
{
  "prompt": "<scene prose — no duplicate of grooming paragraphs>",
  "grooming": { "hair": "<…>", "makeup": "<…>" }
}
At most a short forward reference to grooming inside "prompt", not full duplication.
`.trim();

export const EXPAND_PROMPTS_INSTRUCTION = `
You turn a style JSON (from a REFERENCE photo) into ONE rich scene for a DIFFERENT person — the user's face comes only from their attached photo. Transfer pose, light, wardrobe, environment, camera, grade, mood; output identity = USER, not the reference model. User must look restyled, not pasted from a casual selfie.

Generate structured JSON. In "prompt", immediately after the required opening line, use ~35–45% of words for dense POSE + BODY from subject_pose (keep viewer/subject shoulder language, weight, spine, hands, gaze vs head). Then expression + vibe (scene/genre/mood). Then camera+composition, environment, wardrobe, lighting, color grade from color_grading/color_palette (rephrase palette as light/set — never assign reference hair/eye/skin as the user's identity). Weave key_details as transferable anchors (keep pose/prop/light beats; strip reference-only biometrics — e.g. "natural eye color", "natural hair color and length"). Use two short "prompt" paragraphs if needed so pose stays early.
Never compress subject_pose to a generic portrait; keep quarter-turn, ¾ face, uneven shoulders if JSON has them. All hair_makeup prose goes into grooming.* only — "prompt" may mention that hair/makeup match the reference in one short phrase, not full duplication.

Rules:
1. Start with: "Place the person from the attached photo into this scene:"
2. 220–420 words; one paragraph or two short ones (pose first).
3. No vague "natural lighting" / "warm tones" / "relaxed pose" without concrete geometry and direction.
4. Remind once: identity = attached user only.
5. If hair_makeup is styled, output must not read like unchanged casual user hair/face — carry style in grooming.

Return ONLY a JSON object (not an array):
{
  "prompt": "<scene prose; hair/makeup only briefly referenced, full detail in grooming>",
  "grooming": {
    "hair": "<from hair_makeup; \"\" if unstyled>",
    "makeup": "<from hair_makeup; \"\" if bare-faced>"
  }
}
`.trim();

/**
 * Full text sent to Gemini image generation for vibe rows (must match generate-process).
 * Appends {@link GENERATE_VIBE_TRAILING_POSE_LOCK_DUAL} or {@link GENERATE_VIBE_TRAILING_POSE_LOCK_SINGLE}
 * after the scene body so the image model re-attends to geometry vs casual upload pose.
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
  const scene = String(rawExpandedPrompt ?? "").trimEnd();
  if (assumeReferenceImageLoaded) {
    if (oneShotExtractConfigEnabled) {
      return `${GENERATE_VIBE_PREFIX_TWO_IMAGES_ONE_SHOT}${scene}\n\n${GENERATE_VIBE_TRAILING_POSE_LOCK_DUAL}`;
    }
    return `${GENERATE_VIBE_PREFIX_TWO_IMAGES}${GENERATE_VIBE_JSON_IDENTITY_BRIDGE_DUAL}${scene}\n\n${GENERATE_VIBE_TRAILING_POSE_LOCK_DUAL}`;
  }
  if (oneShotExtractConfigEnabled) {
    return `${GENERATE_VIBE_PREFIX_SINGLE_IMAGE_ONE_SHOT}${scene}\n\n${GENERATE_VIBE_TRAILING_POSE_LOCK_SINGLE}`;
  }
  return `${GENERATE_VIBE_PREFIX_SINGLE_IMAGE}${scene}\n\n${GENERATE_VIBE_TRAILING_POSE_LOCK_SINGLE}`;
}
