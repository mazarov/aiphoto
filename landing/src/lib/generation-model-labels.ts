import {
  GROK_IMAGINE_IMAGE_CREDIT_COST,
  SEEDREAM_45_IMAGE_MODEL,
  forcedImageCreditCost,
} from "./generation/image-options";

/**
 * Product-facing names for Gemini image models (LexyGPT / Google “Nano Banana” naming).
 * API ids stay Gemini; only UI labels change.
 */

export type GenerationModelDisplay = {
  label: string;
  description: string;
};

export type GenerationModelOption = {
  id: string;
  label: string;
  cost: number;
};

/** Known Gemini image model ids → Nano Banana display names. */
export const GENERATION_MODEL_DISPLAY: Record<string, GenerationModelDisplay> = {
  "gemini-2.5-flash-image": {
    label: "Nano Banana",
    description: "Быстрые превью для идей",
  },
  "gemini-3-pro-image-preview": {
    label: "Nano Banana PRO",
    description: "Максимальная детализация",
  },
  "gemini-3.1-flash-image-preview": {
    label: "Nano Banana 2",
    description: "Улучшенные алгоритмы генерации",
  },
  "gemini-3.1-flash-image": {
    label: "Nano Banana 2",
    description: "Улучшенные алгоритмы генерации",
  },
  "gemini-3.1-flash-lite-image": {
    label: "Nano Banana 2 Lite",
    description: "Оптимизированная генерация",
  },
  "gemini-3.1-flash-lite-image-preview": {
    label: "Nano Banana 2 Lite",
    description: "Оптимизированная генерация",
  },
  "gemini-omni-flash-preview": {
    label: "Veo Omni Flash",
    description: "Фото оживает по твоему сценарию",
  },
  "grok-imagine-image-2.0": {
    label: "Grok Imagine",
    description: "Креативная генерация",
  },
  "seedream-4.5": {
    label: "Seedream 4.5",
    description: "Стильные и чувственные сцены",
  },
  "seedream-5.0-pro": {
    label: "Seedream 5.0 Pro",
    description: "Стильные и чувственные сцены",
  },
  "flux-2-flex": {
    label: "Flux 2 Flex",
    description: "Баланс качества, скорости и контроля",
  },
  "grok-imagine-video-1.5": {
    label: "Grok Imagine 1.5",
    description: "Динамичное видео из фото",
  },
  "veo-3.1-lite-generate-preview": {
    label: "Veo 3.1 Lite",
    description: "Озвученное видео из фото",
  },
  "seedance-2.5": {
    label: "Seedance 2.5",
    description: "Кинематографические видео до 30 секунд",
  },
};

export const FALLBACK_VIDEO_GENERATION_MODELS: GenerationModelOption[] = [
  {
    id: "grok-imagine-video-1.5",
    label: GENERATION_MODEL_DISPLAY["grok-imagine-video-1.5"].label,
    cost: 30,
  },
  {
    id: "gemini-omni-flash-preview",
    label: GENERATION_MODEL_DISPLAY["gemini-omni-flash-preview"].label,
    cost: 30,
  },
  {
    id: "veo-3.1-lite-generate-preview",
    label: GENERATION_MODEL_DISPLAY["veo-3.1-lite-generate-preview"].label,
    cost: 15,
  },
];

export const FALLBACK_GENERATION_MODELS: GenerationModelOption[] = [
  {
    id: "gemini-2.5-flash-image",
    label: GENERATION_MODEL_DISPLAY["gemini-2.5-flash-image"].label,
    cost: 5,
  },
  {
    id: "gemini-3-pro-image-preview",
    label: GENERATION_MODEL_DISPLAY["gemini-3-pro-image-preview"].label,
    cost: 10,
  },
  {
    id: "gemini-3.1-flash-image-preview",
    label: GENERATION_MODEL_DISPLAY["gemini-3.1-flash-image-preview"].label,
    cost: 10,
  },
  {
    id: "gemini-3.1-flash-lite-image",
    label: GENERATION_MODEL_DISPLAY["gemini-3.1-flash-lite-image"].label,
    cost: 5,
  },
  {
    id: "grok-imagine-image-2.0",
    label: GENERATION_MODEL_DISPLAY["grok-imagine-image-2.0"].label,
    cost: GROK_IMAGINE_IMAGE_CREDIT_COST,
  },
];

export function displayLabelForGenerationModel(
  id: string,
  fallbackLabel?: string
): string {
  return GENERATION_MODEL_DISPLAY[id]?.label || fallbackLabel || id;
}

export function displayDescriptionForGenerationModel(
  id: string,
  fallback = ""
): string {
  return GENERATION_MODEL_DISPLAY[id]?.description || fallback;
}

export function optionLabelForGenerationModel(
  id: string,
  fallbackLabel?: string
): string {
  const d = GENERATION_MODEL_DISPLAY[id];
  if (d) return `${d.label} — ${d.description}`;
  return fallbackLabel || id;
}

function parseGenerationModels(
  raw: string | null | undefined,
  fallback: GenerationModelOption[]
): GenerationModelOption[] {
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;

    const models = parsed
      .filter(
        (model): model is {
          id: string;
          label?: string;
          cost?: number;
          enabled?: boolean;
        } =>
          Boolean(model) &&
          typeof model.id === "string" &&
          model.enabled !== false &&
          model.id !== SEEDREAM_45_IMAGE_MODEL
      )
      .map((model) => ({
        id: model.id,
        label: displayLabelForGenerationModel(model.id, model.label),
        cost: forcedImageCreditCost(model.id)
          ?? (Number.isFinite(model.cost) ? Number(model.cost) : 0),
      }));
    return models.length ? models : fallback;
  } catch {
    return fallback;
  }
}

export function parseEnabledGenerationModels(
  raw: string | null | undefined
): GenerationModelOption[] {
  return parseGenerationModels(raw, FALLBACK_GENERATION_MODELS);
}

export function parseEnabledVideoGenerationModels(
  raw: string | null | undefined
): GenerationModelOption[] {
  return parseGenerationModels(raw, FALLBACK_VIDEO_GENERATION_MODELS);
}
