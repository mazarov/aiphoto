import { PHOTOSHOOT_EDIT_KIND } from "./photoshoot";

/** Exclusive generate-dock mode. Photoshoot is a button, not a third model sheet. */
export type GenerateComposeMode = "image" | "video" | "photoshoot";

export type PhotoshootReadyFrame = {
  generationId: string;
  resultUrl: string;
};

/** Selected library photo shown on the «Ваши фото» tile. Compose photoshoot SSOT. */
export type PhotoshootLibraryFrame = {
  photoId: string;
  storagePath: string;
  previewUrl: string;
  width: number | null;
  height: number | null;
};

export const PHOTOSHOOT_NEEDS_LIBRARY_PHOTO =
  "Для фотосессии выберите одно фото";

export const PHOTOSHOOT_NEEDS_READY_FRAME = PHOTOSHOOT_NEEDS_LIBRARY_PHOTO;

export function isGenerateComposeMode(value: unknown): value is GenerateComposeMode {
  return value === "image" || value === "video" || value === "photoshoot";
}

/** Prompt stash and vendor modality: photoshoot reuses the image draft. */
export function promptModalityForComposeMode(
  mode: GenerateComposeMode
): "image" | "video" {
  return mode === "video" ? "video" : "image";
}

export function apiModalityForComposeMode(
  mode: GenerateComposeMode
): "image" | "video" {
  return promptModalityForComposeMode(mode);
}

export function rememberCompletedImageResult(input: {
  generationId?: string | null;
  resultUrl?: string | null;
  resultModality?: "image" | "video" | null;
  previous?: PhotoshootReadyFrame | null;
}): PhotoshootReadyFrame | null {
  if (input.resultModality === "video") return input.previous ?? null;
  const generationId = input.generationId?.trim() || "";
  const resultUrl = input.resultUrl?.trim() || "";
  if (!generationId || !resultUrl) return input.previous ?? null;
  return { generationId, resultUrl };
}

export function resolvePhotoshootReadyFrame(input: {
  generationId?: string | null;
  resultUrl?: string | null;
  resultModality?: "image" | "video" | null;
  lastImageResult?: PhotoshootReadyFrame | null;
}): PhotoshootReadyFrame | null {
  const generationId = input.generationId?.trim() || "";
  const resultUrl = input.resultUrl?.trim() || "";
  if (generationId && resultUrl && input.resultModality !== "video") {
    return { generationId, resultUrl };
  }
  const last = input.lastImageResult;
  if (last?.generationId.trim() && last.resultUrl.trim()) {
    return { generationId: last.generationId, resultUrl: last.resultUrl };
  }
  return null;
}

export function resolvePhotoshootLibraryFrame(input: {
  selectedPhotos: Array<{
    id?: string | null;
    storagePath?: string | null;
    previewUrl?: string | null;
    width?: number | null;
    height?: number | null;
  }>;
}): PhotoshootLibraryFrame | null {
  if (input.selectedPhotos.length !== 1) return null;
  const photo = input.selectedPhotos[0];
  const photoId = photo.id?.trim() || "";
  const storagePath = photo.storagePath?.trim() || "";
  if (!photoId || !storagePath) return null;
  return {
    photoId,
    storagePath,
    previewUrl: photo.previewUrl?.trim() || "",
    width: photo.width ?? null,
    height: photo.height ?? null,
  };
}

export type ComposeModeTileSheet = "photos" | "model";

/** Image and video tiles open the model sheet. Photoshoot is select-only. */
export function composeModeTileSheet(
  mode: GenerateComposeMode,
): ComposeModeTileSheet | null {
  return mode === "photoshoot" ? null : "model";
}

/** Mode tile caption. Preview photo stays on «Ваши фото», not on these tiles. */
export function composeModeTileLabel(mode: GenerateComposeMode): string {
  if (mode === "video") return "Видео";
  if (mode === "photoshoot") return "Фотосессия";
  return "Фото";
}

/** Idle footer CTA for the selected compose block. */
export function composeGenerateCtaLabel(mode: GenerateComposeMode): string {
  if (mode === "video") return "Создать видео";
  if (mode === "photoshoot") return "Создать фотосессию";
  return "Создать фото";
}

/** Paywall CTA: next action, not an error. Compact label is for the mobile tab. */
export const COMPOSE_BUY_CREDITS_CTA = "Купить кредиты для создания фото";
export const COMPOSE_BUY_CREDITS_CTA_COMPACT = "Купить кредиты";

/** Photo/video model name belongs on the generate button, not the mode tile. */
export function composeGenerateCtaShowsModelName(
  mode: GenerateComposeMode,
): boolean {
  return mode === "image" || mode === "video";
}

/** Repeat click on the same model tile closes the sheet. Photoshoot never opens one. */
export function nextComposeModeTileSheet(input: {
  mode: GenerateComposeMode;
  alreadyInMode: boolean;
  currentSheet: "photos" | "model" | "prompt" | null;
}): ComposeModeTileSheet | null {
  if (input.mode === "photoshoot") return null;
  if (!input.alreadyInMode) return "model";
  return input.currentSheet === "model" ? null : "model";
}

/** Photoshoot mode must not enqueue a regular image/video job. */
export function canEnqueueWhilePhotoshootSelected(input: {
  composeMode: GenerateComposeMode;
  editKind?: string | null;
}): boolean {
  if (input.composeMode !== "photoshoot") return true;
  return input.editKind === PHOTOSHOOT_EDIT_KIND;
}
