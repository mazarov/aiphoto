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
};

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
 * The style block is what the user chose; identity / background rules are added by the worker.
 */
export function buildStickerPromptText(styleId: string): string {
  const style = findStickerStyle(styleId) ?? STICKER_STYLES[0];
  return [`${STICKER_PROMPT_MARKER} style=${style.id}`, style.prompt].join("\n");
}

export function parseStickerStyleIdFromPrompt(promptText: unknown): string | null {
  const text = String(promptText ?? "");
  const match = /^STICKER style=([a-z0-9_-]+)/m.exec(text);
  return match ? match[1] : null;
}

export function stripStickerPromptMarker(promptText: string): string {
  return String(promptText ?? "")
    .split("\n")
    .filter((line) => !/^STICKER style=/.test(line.trim()))
    .join("\n")
    .trim();
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

/** Worker prompt for Gemini / Grok / Seedream sticker jobs. */
export function assembleStickerFinalPrompt(rawPrompt: string): string {
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
