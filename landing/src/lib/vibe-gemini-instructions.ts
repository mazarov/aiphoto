/**
 * Shared defaults for vibe extract/expand models, image-gen labels, and `assembleVibeFinalPrompt`.
 * Legacy extract/expand instructions live in `vibe-legacy-prompt-chain.ts`; `GET /api/vibe/pipeline-spec` re-exports them.
 */

import { createSupabaseServer } from "@/lib/supabase";
export {
  assembleLandingCardFinalPrompt,
  assembleVibeFinalPrompt,
  GENERATE_LANDING_CARD_CRITICAL_RULES,
  VIBE_IMAGE_PART_LABEL_REFERENCE,
  VIBE_IMAGE_PART_LABEL_SUBJECT,
} from "@/lib/image-generation-prompt";

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