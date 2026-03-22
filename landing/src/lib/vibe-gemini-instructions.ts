/**
 * Shared defaults for vibe extract/expand models, image-gen labels, and `assembleVibeFinalPrompt`.
 * Legacy extract/expand instructions live in `vibe-legacy-prompt-chain.ts`; `GET /api/vibe/pipeline-spec` re-exports them.
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

/** Minimum length for scene prompt validation in grooming helpers (legacy expand does not use this gate). */
export const MIN_VIBE_SCENE_PROMPT_CHARS = 600;

/** `gemini` | `openai` — which backend runs `/api/vibe/extract` (vision → legacy JSON: scene…composition + pose). */
export const PHOTO_APP_CONFIG_KEY_VIBE_EXTRACT_LLM = "vibe_extract_llm";

/** `gemini` | `openai` — which backend runs `/api/vibe/expand` (legacy style JSON → 3-accent JSON + merge; expand passthrough ignores LLM when legacy). */
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

/** Placed immediately BEFORE the reference inline image in the multi-part request. */
export const VIBE_IMAGE_PART_LABEL_REFERENCE = `
[IMAGE A — STYLE REFERENCE ONLY]
The NEXT part is a photograph used ONLY as a recipe: pose, lighting, wardrobe style, hair styling, makeup/beauty look, background, camera, color grade, mood.
It is NOT the person to depict in the output. Do NOT copy this person's face, bone structure, skin, eyes, or hair color as the result identity.
`.trim();

/** Placed immediately BEFORE the user's photo inline image(s). */
export const VIBE_IMAGE_PART_LABEL_SUBJECT = `
[IMAGE B — SUBJECT / USER IDENTITY]
The NEXT image is the ONLY source for WHO the person is: face shape, bone structure, features, eyes, skin undertone, age, body, and natural HAIR COLOR/pigment (never use A's hair color).
It is NOT the styling source for hair layout or makeup when the long text below includes "Hair styling (transfer from reference)" and/or "Makeup and skin (transfer from reference)": then hair STYLING and MAKEUP LOOK come from IMAGE A, not from B's pixels — only B's identity + hair pigment stay from B.
If those grooming sections are absent in the text, keep B's casual hair and face as in B.
The output must read as B's face, not A's. If it looks like A's face, you FAILED.
Ignore B's pose, head tilt, and camera angle when they conflict with IMAGE A — re-pose to match A's geometry and the scene.
`.trim();

/**
 * Final image-gen text order: **scene first** (recognition / expand body), then one **CRITICAL RULES** block.
 * Dual-image: IMAGE A/B labels are separate parts in `generate-process` before this string.
 */

/** Shared tail for all image-gen CRITICAL RULES (card + vibe). Pixel cap still from `generationConfig.imageConfig.imageSize`. */
const IMAGE_QUALITY_CRITICAL_BULLET =
  "- Photorealistic output, high textural detail, high quality, 8K-grade resolution and micro-detail (maximize sharpness and surface fidelity).";

const GENERATE_VIBE_CRITICAL_RULES_SINGLE = `
CRITICAL RULES
- Preserve: face structure, features, skin tone, eye color, proportions.
- Subject must look naturally photographed in the setting, not pasted.
${IMAGE_QUALITY_CRITICAL_BULLET}
`.trim();

/**
 * Card / debug web generation (`landing_generations` without `vibe_id`): user photo(s) + prompt text only.
 * Pushes the model to take wardrobe from the text, not from input pixels.
 */
export const GENERATE_LANDING_CARD_CRITICAL_RULES = `
CRITICAL RULES
The input image(s) show the SUBJECT (a real person). Output exactly one new photorealistic photograph of that same person following the text description above (the prompt).

- Identity: preserve the same person — face structure, features, skin tone, eye color, body proportions, natural hair color from the input. Do not swap in a different face or body.
- Wardrobe — fully replace clothing: ignore the apparel, shoes, and visible accessories in the input photo as the outfit to keep. Treat input clothing as something to discard unless the text explicitly says to preserve it. Dress the subject exactly as the text prompt describes — fully change the outfit to match the prompt; do not default to copying the T-shirt, hoodie, jeans, dress, or shoes from the upload. If the text names specific garments, colors, or style, the output must show those.
- Result must look naturally photographed, not pasted or flatly composited.
${IMAGE_QUALITY_CRITICAL_BULLET}
`.trim();

const GENERATE_VIBE_CRITICAL_RULES_DUAL = `
CRITICAL RULES
Earlier parts were labeled: IMAGE A = style reference (not the output identity); IMAGE B = subject (only identity). Output one new photograph of B as if shot in A's session — A's pose, light, set, wardrobe, and grade on B. Not a face-swap or lazy crop.

- Scene / Genre / Mood (and similar prose) were written from the reference image and may still mention hair, face, or skin. Treat that as **setting and atmosphere only**. They must NOT replace IMAGE B's face, natural hair color, hair length, or resting hairstyle. If there is **no** "Hair styling (transfer from reference):" section in the text, keep B's real hair from B's photo — ignore any hair adjectives in Scene. If that section **is** present, take hair **styling** from A and natural **pigment** from B (as below).
- Split sources: from B = identity (face, bones, eyes, body) + natural HAIR COLOR only. From A = hair STYLING and MAKEUP LOOK when the text includes the grooming-transfer sections — then do not treat B's hairstyle or makeup in B's photo as the target; override them with A's styled look while keeping B's face and hair pigment.
- If grooming transfer is requested, the change must read clearly in pixels — B must not look like an unstyled snapshot of B when A is clearly groomed.
- Grooming = beauty finish only — does not override torso/head angles from A or the scene.
- Wardrobe, set, light, camera, palette: match A + scene on B.
${IMAGE_QUALITY_CRITICAL_BULLET}
`.trim();

function joinVibeFinalPromptParts(scene: string, criticalRules: string): string {
  const body = String(scene ?? "").trimEnd();
  return `${body}\n\n${criticalRules}`.trim();
}

/**
 * Detect grooming sections in the unprefixed body (legacy expand blocks or split-path inserts).
 * Keep in sync with {@link appendLegacyGroomingPolicyBlocks} and {@link buildGroomingInsert}.
 */
function detectGroomingSectionsInUnprefixedBody(body: string): { hair: boolean; makeup: boolean } {
  const b = String(body ?? "");
  const hair =
    b.includes("Hair styling (transfer from reference):") || b.includes("Hair styling (match reference shoot):");
  const makeup =
    b.includes("Makeup and skin (transfer from reference):") ||
    b.includes("Makeup and skin finish (match reference shoot):");
  return { hair, makeup };
}

/**
 * Short imperative block placed **after** CRITICAL RULES when two images are used and grooming is requested.
 * Image models (e.g. Gemini 3.x Flash image) often weight the tail of the text more than mid-body paragraphs.
 */
function buildFlashImageGroomingRecencyTail(unprefixedBody: string): string {
  const { hair, makeup } = detectGroomingSectionsInUnprefixedBody(unprefixedBody);
  if (!hair && !makeup) return "";
  const lines: string[] = [
    "LAST — must show in the output image (not optional wording):",
    "Hierarchy: B = who + natural hair color; A = hair styling + makeup (for this request). Ignore B's haircut/makeup pixels as the goal when they differ from A.",
  ];
  if (hair) {
    lines.push(
      "• Hair: visibly match IMAGE A's styling (silhouette, volume, parting, finish) on B's head; keep only B's natural pigment — not B's original layout from the photo.",
    );
  }
  if (makeup) {
    lines.push(
      "• Face: visibly match IMAGE A's makeup and skin finish on B — replace B's casual look, do not clone B's bare/casual face from the input.",
    );
  }
  return `\n\n${lines.join("\n")}`;
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
 * Full text sent to Gemini image generation for vibe rows (must match generate-process).
 * Order: **scene body first** (from expand / DB), then **CRITICAL RULES** (single merged block).
 * Dual-image + grooming paragraphs in the body: optional **LAST** block after CRITICAL (recency for Flash image).
 * Dual-image: A/B labels are separate multimodal parts in `generate-process`, not in this string.
 * `assumeReferenceImageLoaded`: true when reference pixels are attached with the user image.
 */
export function assembleVibeFinalPrompt(rawExpandedPrompt: string, assumeReferenceImageLoaded = false): string {
  const scene = String(rawExpandedPrompt ?? "").trimEnd();
  if (assumeReferenceImageLoaded) {
    const withCritical = joinVibeFinalPromptParts(scene, GENERATE_VIBE_CRITICAL_RULES_DUAL);
    return `${withCritical}${buildFlashImageGroomingRecencyTail(scene)}`.trim();
  }
  return joinVibeFinalPromptParts(scene, GENERATE_VIBE_CRITICAL_RULES_SINGLE);
}

/**
 * Non-vibe card generation: same order as vibe — **prompt body first**, then **CRITICAL RULES** (wardrobe from text).
 * Used in `generate-process` when `vibe_id` is null.
 */
export function assembleLandingCardFinalPrompt(rawCardPrompt: string): string {
  return joinVibeFinalPromptParts(String(rawCardPrompt ?? "").trimEnd(), GENERATE_LANDING_CARD_CRITICAL_RULES);
}
