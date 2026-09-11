import type { GenerateComposeMode } from "./generate-compose-mode";

/** Footer / sheet CTA when the first image job still needs an explicit model pick. */
export const COMPOSE_PICK_IMAGE_MODEL_CTA = "Выбрать модель";

/** Mini pill on Nano Banana PRO in the model picker. */
export const COMPOSE_RU_TEXT_BADGE = "Русский текст";
export const COMPOSE_RU_TEXT_BADGE_HINT =
  "Лучше читает русский текст на кадре";

const NANO_BANANA_PRO_IMAGE_MODEL = "gemini-3-pro-image-preview";

export function composeImageModelRuTextBadge(
  modelId: string | null | undefined,
): string | null {
  return String(modelId || "").trim() === NANO_BANANA_PRO_IMAGE_MODEL
    ? COMPOSE_RU_TEXT_BADGE
    : null;
}

export const COMPOSE_CHOSEN_IMAGE_MODEL_STORAGE_KEY =
  "promptshot:compose-chosen-image-model";

export function composeNeedsImageModelPick(input: {
  composeMode: GenerateComposeMode;
  modelId: string | null | undefined;
}): boolean {
  if (input.composeMode !== "image") return false;
  return !String(input.modelId || "").trim();
}

/**
 * After a selfie/upload: open the model sheet unless an example sheet is about
 * to open (that sheet goes first; model follows on confirm).
 */
export function composeShouldAutoOpenModelSheet(input: {
  composeMode: GenerateComposeMode;
  modelId: string | null | undefined;
  exampleSheetWillOpen?: boolean;
}): boolean {
  if (input.exampleSheetWillOpen) return false;
  return composeNeedsImageModelPick(input);
}

export function hasCompletedImageGenerationFromList(
  generations:
    | Array<{ status?: string | null; modality?: string | null }>
    | null
    | undefined,
): boolean {
  return (generations || []).some((item) => {
    if (item.status !== "completed") return false;
    return (item.modality || "image") !== "video";
  });
}

/**
 * First image job: no product default. After a completed photo job, restore
 * the last stored model (or the enabled fallback).
 */
export function resolveComposerImageModel(input: {
  storedModel?: string | null;
  imageModelIds: readonly string[];
  hasCompletedImageGeneration: boolean;
  explicitModelId?: string | null;
  defaultModel?: string | null;
}): string {
  const ids = input.imageModelIds;
  const explicit = String(input.explicitModelId || "").trim();
  if (explicit && ids.includes(explicit)) return explicit;
  if (!input.hasCompletedImageGeneration) return "";
  const stored = String(input.storedModel || "").trim();
  if (stored && ids.includes(stored)) return stored;
  const fallback = String(input.defaultModel || "").trim();
  if (fallback && ids.includes(fallback)) return fallback;
  return ids[0] || "";
}

export function readSessionChosenImageModel(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage
      .getItem(COMPOSE_CHOSEN_IMAGE_MODEL_STORAGE_KEY)
      ?.trim();
    return value || null;
  } catch {
    return null;
  }
}

export function writeSessionChosenImageModel(modelId: string): void {
  if (typeof window === "undefined") return;
  const next = modelId.trim();
  if (!next) return;
  try {
    window.sessionStorage.setItem(COMPOSE_CHOSEN_IMAGE_MODEL_STORAGE_KEY, next);
  } catch {
    // Private mode / quota — in-memory compose state remains.
  }
}
