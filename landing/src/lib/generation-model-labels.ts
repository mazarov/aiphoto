/**
 * Product-facing names for Gemini image models (LexyGPT / Google “Nano Banana” naming).
 * API ids stay Gemini; only UI labels change.
 */

export type GenerationModelDisplay = {
  label: string;
  description: string;
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
