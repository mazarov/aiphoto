/**
 * Sticker generation contract — shared by landing API, worker and `/stiker-iz-foto` UI.
 * No `@/` imports: the worker compiles this file via tsconfig include + Dockerfile COPY.
 */

export const STICKER_EDIT_KIND = "sticker";
/** `generation_surface` is a closed enum (`prompt_card` | `seo_page`); sticker jobs are told apart by `edit_kind`. */
export const STICKER_GENERATION_SURFACE = "seo_page";
export const STICKER_CONFIG_ENABLED_KEY = "sticker_generation_enabled";
export const STICKER_CONFIG_MODEL_KEY = "sticker_model";
export const STICKER_ASPECT_RATIO = "1:1";
export const STICKER_IMAGE_SIZE = "1K";
/** Telegram / Max / WhatsApp static sticker: 512 px on the long side, PNG or WebP. */
export const STICKER_OUTPUT_PX = 512;
/** White die-cut outline width at output scale. */
export const STICKER_OUTLINE_PX = 10;
/** Flat background the model paints; rembg + chroma cleanup remove it. */
export const STICKER_BACKGROUND_HEX = "#FF00FF";
export const STICKER_PATH = "/stiker-iz-foto";
/** Idle FAB / tab / hero CTA on `/stiker-iz-foto`. */
export const STICKER_GENERATE_CTA = "Создать стикер";

export type StickerStyle = {
  id: string;
  label: string;
  /** Short chip hint shown under the label. */
  hint: string;
  /** Style block for the image model (English, imperative). */
  prompt: string;
  /** Bot `style_groups.id`; fallback styles have no group. */
  groupId?: string | null;
  emoji?: string | null;
  /** Bot `style_presets_v2.description_ru` — shown under the name in the picker. */
  description?: string | null;
  isDefault?: boolean;
};

export type StickerStyleGroup = {
  id: string;
  label: string;
  emoji: string | null;
};

/** Emotion / motion preset from the bot (`emotion_presets`, `motion_presets`). `hint` goes to the model. */
export type StickerPreset = {
  id: string;
  label: string;
  emoji: string | null;
  hint: string;
};

/**
 * Fallback styles. Production reads `style_presets_v2` (shared Supabase with the bot);
 * these stay for the SEO page and for the API when the DB read fails or returns nothing.
 */
export const STICKER_STYLES: readonly StickerStyle[] = [
  {
    id: "cartoon",
    label: "Мультяшный",
    hint: "как в мультфильме",
    prompt:
      "Modern 2D cartoon illustration: bold clean line art, flat cel shading with soft highlights, slightly enlarged head and expressive eyes, saturated but harmonious colors.",
  },
  {
    id: "anime",
    label: "Аниме",
    hint: "японская анимация",
    prompt:
      "Anime illustration: large expressive eyes, crisp line art, soft cel shading, stylized hair with glossy highlights, vivid palette.",
  },
  {
    id: "3d",
    label: "3D",
    hint: "объёмный персонаж",
    prompt:
      "Stylized 3D character render in the manner of modern animated feature films: smooth subsurface skin, soft studio lighting, rounded friendly proportions, glossy eyes.",
  },
  {
    id: "meme",
    label: "Мем",
    hint: "ярко и смешно",
    prompt:
      "Bold meme-style sticker: thick black outlines inside the figure, exaggerated but recognizable expression, punchy flat colors, high contrast.",
  },
  {
    id: "watercolor",
    label: "Акварель",
    hint: "мягкий рисунок",
    prompt:
      "Hand-painted watercolor portrait: soft wet-on-wet washes, visible paper grain, gentle ink contour, pastel palette.",
  },
  {
    id: "photo",
    label: "Фото",
    hint: "реалистичный вырез",
    prompt:
      "Photorealistic cut-out portrait: natural skin texture, soft frontal studio light, true-to-life colors, sharp focus on the face.",
  },
] as const;

export const DEFAULT_STICKER_STYLE_ID = STICKER_STYLES[0].id;

export function isStickerEditKind(value: unknown): boolean {
  return String(value ?? "").trim() === STICKER_EDIT_KIND;
}

export function findStickerStyle(id: unknown): StickerStyle | null {
  const key = String(id ?? "").trim();
  if (!key) return null;
  return STICKER_STYLES.find((style) => style.id === key) ?? null;
}

/** Prompt marker persisted in `prompt_text`; lets the worker and admin recognise sticker jobs by text too. */
export const STICKER_PROMPT_MARKER = "STICKER";

/**
 * Server-side SSOT for `landing_generations.prompt_text` of a sticker job.
 * The style block is the DB row (or fallback) the user chose; identity / background rules are added by the worker.
 */
export function buildStickerPromptText(style: Pick<StickerStyle, "id" | "prompt"> | string): string {
  const resolved =
    typeof style === "string"
      ? (findStickerStyle(style) ?? STICKER_STYLES[0])
      : { id: String(style.id || "").trim() || STICKER_STYLES[0].id, prompt: String(style.prompt || "").trim() || STICKER_STYLES[0].prompt };
  return [`${STICKER_PROMPT_MARKER} style=${resolved.id}`, resolved.prompt].join("\n");
}

export function parseStickerStyleIdFromPrompt(promptText: unknown): string | null {
  const text = String(promptText ?? "");
  const match = /^STICKER style=([A-Za-z0-9_-]+)/m.exec(text);
  return match ? match[1] : null;
}

export function stripStickerPromptMarker(promptText: string): string {
  return String(promptText ?? "")
    .split("\n")
    .filter((line) => !/^STICKER (style=|edit=|text$)/.test(line.trim()))
    .join("\n")
    .trim();
}

/* ---------- Edits from a finished sticker: emotion / motion (model) and text (overlay, free) ---------- */

export const STICKER_EDIT_ACTIONS = ["emotion", "motion"] as const;
export type StickerEditAction = (typeof STICKER_EDIT_ACTIONS)[number];
export const STICKER_TEXT_ACTION = "text";
/** Preset id persisted in the marker when the user typed their own hint. */
export const STICKER_CUSTOM_PRESET_ID = "custom";
export const STICKER_CUSTOM_HINT_MIN = 2;
export const STICKER_CUSTOM_HINT_MAX = 120;
/** Same cap as the bot overlay (`addTextToSticker`). */
export const STICKER_TEXT_MAX_CHARS = 30;

export function isStickerEditAction(value: unknown): value is StickerEditAction {
  return STICKER_EDIT_ACTIONS.includes(String(value ?? "").trim() as StickerEditAction);
}

/** One line, collapsed whitespace, capped. Empty string when too short. */
export function sanitizeStickerCustomHint(value: unknown): string {
  const text = String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, STICKER_CUSTOM_HINT_MAX);
  return text.length >= STICKER_CUSTOM_HINT_MIN ? text : "";
}

/** Overlay text: one line, trimmed, ≤ 30 chars. Empty when nothing is left. */
export function normalizeStickerOverlayText(value: unknown): string {
  return String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, STICKER_TEXT_MAX_CHARS);
}

export type StickerEditSpec = {
  action: StickerEditAction;
  presetId: string;
  hint: string;
};

/** `prompt_text` of an emotion / motion job: marker line + the hint the model gets. */
export function buildStickerEditPromptText(spec: StickerEditSpec): string {
  const presetId = String(spec.presetId || "").trim() || STICKER_CUSTOM_PRESET_ID;
  return [`${STICKER_PROMPT_MARKER} edit=${spec.action} preset=${presetId}`, spec.hint.trim()].join("\n");
}

export function parseStickerEditFromPrompt(promptText: unknown): StickerEditSpec | null {
  const text = String(promptText ?? "");
  const match = /^STICKER edit=(emotion|motion) preset=([A-Za-z0-9_-]+)\s*\n([\s\S]*)$/m.exec(text);
  if (!match) return null;
  const hint = match[3].trim();
  if (!hint) return null;
  return { action: match[1] as StickerEditAction, presetId: match[2], hint };
}

/** `prompt_text` of a free text-overlay row (no model run). */
export function buildStickerTextPromptText(text: string): string {
  return [`${STICKER_PROMPT_MARKER} text`, normalizeStickerOverlayText(text)].join("\n");
}

export function isStickerTextPromptText(promptText: unknown): boolean {
  return /^STICKER text\n/.test(String(promptText ?? ""));
}

/** Worker prompt for an emotion / motion edit of an existing sticker. Ported from the bot's imported-sticker editor. */
export function assembleStickerEditFinalPrompt(spec: StickerEditSpec): string {
  const changeType = spec.action === "emotion" ? "emotion / facial expression" : "motion / body pose and gesture";
  return `
You are an image editor. You are given an existing messenger sticker of one person (the SUBJECT) on a flat bright magenta (${STICKER_BACKGROUND_HEX}) background.

YOUR TASK: edit this sticker by changing ONLY the ${changeType} to: "${spec.hint}".

EVERYTHING else MUST remain exactly the same:
- Same person: face structure, eye color, skin tone, hair color and shape, glasses and marks.
- Same art style, line work and coloring technique — if the input is a photo, output a photo; if cartoon, cartoon; if anime, anime.
- Same clothing, accessories and props unless the change itself needs a hand gesture.
- Same chest-up framing, proportions and scale; keep at least 15% empty magenta margin on all four sides, nothing cropped.

CRITICAL RULES:
- Do NOT regenerate the sticker from scratch — make a minimal, targeted edit.
- Background: flat, uniform, pure BRIGHT MAGENTA (${STICKER_BACKGROUND_HEX}) over the whole canvas. No gradient, texture, shadow or props behind the subject.
- Do NOT draw any outline, border, stroke or glow around the figure — the white sticker border is added later.
- No text, letters, captions, emojis, watermarks or logos.
- Avoid magenta or pink tones on the subject itself so chroma cleanup does not eat the figure.
`.trim();
}

export function stickerEditFingerprintFields(
  parentGenerationId: string,
  spec: StickerEditSpec,
): {
  editKind: string;
  parentGenerationId: string;
  stickerAction: StickerEditAction;
  stickerPresetId: string;
  stickerHint: string;
} {
  return {
    editKind: STICKER_EDIT_KIND,
    parentGenerationId: String(parentGenerationId || "").trim(),
    stickerAction: spec.action,
    stickerPresetId: String(spec.presetId || "").trim() || STICKER_CUSTOM_PRESET_ID,
    stickerHint: spec.hint.trim(),
  };
}

export const GENERATE_STICKER_CRITICAL_RULES = `
CRITICAL RULES — STICKER
The input image shows the SUBJECT (a real person). Output exactly one new image of that same person in the style described above. The result will be background-removed programmatically and used as a messenger sticker.

- Identity: preserve the same person — face structure, eye color, skin tone, hair color and shape, distinctive marks (freckles, moles, glasses if worn). Do not swap in a different face.
- Background: flat, uniform, pure BRIGHT MAGENTA (${STICKER_BACKGROUND_HEX}) over the entire canvas. No gradient, no texture, no floor, no shadow on the background, no props behind the subject.
- Framing: chest-up (mid-torso to top of head), head about 40% of canvas height, subject centered. Leave at least 15% empty magenta margin on ALL four sides; hands and hair fully inside the frame, nothing cropped.
- Edges: do NOT draw any outline, border, stroke, glow or contour around the figure — raw clean edges only. The white sticker border is added later.
- No text, letters, captions, emojis, watermarks or logos anywhere.
- Expression: lively but natural; the person should be instantly recognisable.
- Avoid magenta or pink tones on the subject itself (clothes, lips, cheeks lean warm/neutral) so chroma cleanup does not eat the figure.
`.trim();

/** Worker prompt for Gemini / Grok / Seedream sticker jobs — initial style job or emotion / motion edit. */
export function assembleStickerFinalPrompt(rawPrompt: string): string {
  const edit = parseStickerEditFromPrompt(rawPrompt);
  if (edit) return assembleStickerEditFinalPrompt(edit);
  const style = stripStickerPromptMarker(rawPrompt);
  return [style, "", GENERATE_STICKER_CRITICAL_RULES].join("\n").trim();
}

export function stickerFingerprintFields(photoStoragePath: string, styleId: string): {
  editKind: string;
  photoStoragePath: string;
  stickerStyleId: string;
} {
  return {
    editKind: STICKER_EDIT_KIND,
    photoStoragePath: String(photoStoragePath || "").trim(),
    stickerStyleId: String(styleId || "").trim(),
  };
}

/** Prod follows `sticker_generation_enabled`; allowlisted internals stay unlocked. */
export function isStickerFlagOn(value: string | undefined | null): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "on";
}

/** Sticker model from DB. Empty → default model id passed by caller. Unknown / disabled id → null (503). */
export function resolveStickerModel<T extends { id: string }>(
  configValue: string | undefined,
  defaultModelId: string | undefined,
  enabledModels: readonly T[],
): T | null {
  const requested = String(configValue ?? "").trim() || String(defaultModelId ?? "").trim();
  if (!requested) return enabledModels[0] ?? null;
  return enabledModels.find((item) => item.id === requested) ?? null;
}
