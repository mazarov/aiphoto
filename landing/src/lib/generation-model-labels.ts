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
};

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

export function parseEnabledGenerationModels(
  raw: string | null | undefined
): GenerationModelOption[] {
  if (!raw) return FALLBACK_GENERATION_MODELS;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return FALLBACK_GENERATION_MODELS;

    return parsed
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
  } catch {
    return FALLBACK_GENERATION_MODELS;
  }
}
