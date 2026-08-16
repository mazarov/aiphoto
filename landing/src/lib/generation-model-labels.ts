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
    description: "Оживление фото в короткое видео",
  },
};

export const FALLBACK_VIDEO_GENERATION_MODELS: GenerationModelOption[] = [
  {
    id: "gemini-omni-flash-preview",
    label: GENERATION_MODEL_DISPLAY["gemini-omni-flash-preview"].label,
    cost: 30,
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
];

export function displayLabelForGenerationModel(
  id: string,
  fallbackLabel?: string
): string {
  return GENERATION_MODEL_DISPLAY[id]?.label || fallbackLabel || id;
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
          model.enabled !== false
      )
      .map((model) => ({
        id: model.id,
        label: displayLabelForGenerationModel(model.id, model.label),
        cost: Number.isFinite(model.cost) ? Number(model.cost) : 0,
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
