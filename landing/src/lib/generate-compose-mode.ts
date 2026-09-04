import { PHOTOSHOOT_EDIT_KIND } from "./photoshoot";

/** Exclusive generate-dock mode. Photoshoot / photo_prompt are buttons, not model sheets. */
export type GenerateComposeMode = "image" | "video" | "photoshoot" | "photo_prompt";

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
  return (
    value === "image" ||
    value === "video" ||
    value === "photoshoot" ||
    value === "photo_prompt"
  );
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

/** Image/video → model sheet. Photo prompt → «Ваши фото». Photoshoot is select-only. */
export function composeModeTileSheet(
  mode: GenerateComposeMode,
): ComposeModeTileSheet | null {
  if (mode === "photoshoot") return null;
  if (mode === "photo_prompt") return "photos";
  return "model";
}

/** Mode tile caption. Preview photo stays on «Ваши фото», not on these tiles. */
export function composeModeTileLabel(mode: GenerateComposeMode): string {
  if (mode === "video") return "Видео";
  if (mode === "photoshoot") return "Фотосессии";
  if (mode === "photo_prompt") return "Промт по фото";
  return "Фото";
}

/** Dock seed → first compose chip. resume / text / result stay on photo. */
export function composeModeFromDockIntent(intent: string): GenerateComposeMode {
  if (intent === "animate") return "video";
  if (intent === "photo_prompt") return "photo_prompt";
  if (intent === "photoshoot") return "photoshoot";
  return "image";
}

/** Guest footer CTA: pick photo/video first, sign in only on enqueue. */
export const COMPOSE_GUEST_SIGN_IN_CTA = "Войдите";
export const COMPOSE_SELECT_PHOTO_CTA = "Выберите фото";
export const COMPOSE_GUEST_UPLOAD_PHOTO_CTA = "Загрузите фото";

export type ComposeGenerateCtaOptions = {
  isAuthed?: boolean;
  listingVideoRepeat?: boolean;
};

/** Footer when the selected tool still needs a source photo. */
export function composeNeedsPhotoCtaLabel(
  mode: GenerateComposeMode,
  options?: ComposeGenerateCtaOptions,
): string {
  if (mode === "photoshoot" && options?.isAuthed === false) {
    return COMPOSE_GUEST_UPLOAD_PHOTO_CTA;
  }
  return COMPOSE_SELECT_PHOTO_CTA;
}

/** Idle footer CTA for the selected compose block. */
export function composeGenerateCtaLabel(
  mode: GenerateComposeMode,
  options?: ComposeGenerateCtaOptions,
): string {
  if (options?.isAuthed === false && mode !== "photo_prompt") {
    return COMPOSE_GUEST_SIGN_IN_CTA;
  }
  if (mode === "video") {
    return options?.listingVideoRepeat ? "Повторить видео" : "Создать видео";
  }
  if (mode === "photoshoot") return "Создать фотосессию";
  if (mode === "photo_prompt") return "Создать промт по фото";
  return "Создать фото";
}

/** Paywall CTA: next action, not an error. Compact label is for the mobile tab and result rail. */
export const COMPOSE_BUY_CREDITS_CTA = "Купить кредиты для создания фото";
export const COMPOSE_BUY_CREDITS_CTA_COMPACT = "Купить кредиты";
export const COMPOSE_EDIT_RESULT_CTA = "Что изменить";
export const COMPOSE_SAVE_PROMPT_CTA = "Сохранить";
export const COMPOSE_SAVING_PROMPT_CTA = "Сохраняем…";

/** Collapsed prompt strip is off on the result plate until the editor sheet opens. */
export function resultChromeHidesPromptStrip(input: {
  showResultChrome: boolean;
  promptExpanded: boolean;
}): boolean {
  return input.showResultChrome && !input.promptExpanded;
}

/** Result plate: no compose footer — paywall replaces rail «Что изменить». */
export function resultChromeHidesComposeFooter(input: {
  showResultActions: boolean;
  showPhotoPromptResult: boolean;
}): boolean {
  return input.showResultActions || input.showPhotoPromptResult;
}

export function resultPrimaryAction(input: {
  showCreditsCta: boolean;
  remixSaved?: boolean;
}): {
  kind: "credits" | "edit" | "generate";
  label: string;
} {
  if (input.showCreditsCta) {
    return { kind: "credits", label: COMPOSE_BUY_CREDITS_CTA_COMPACT };
  }
  if (input.remixSaved) {
    return { kind: "generate", label: composeGenerateCtaLabel("image") };
  }
  return { kind: "edit", label: COMPOSE_EDIT_RESULT_CTA };
}

/** Photo/video model name belongs on the generate button, not the mode tile. */
export function composeGenerateCtaShowsModelName(
  mode: GenerateComposeMode,
  options?: ComposeGenerateCtaOptions,
): boolean {
  if (options?.isAuthed === false) return false;
  return mode === "image" || mode === "video";
}

/** Repeat click toggles the mode sheet. Photoshoot never opens one. Photo prompt toggles «Ваши фото». */
export function nextComposeModeTileSheet(input: {
  mode: GenerateComposeMode;
  alreadyInMode: boolean;
  currentSheet: "photos" | "model" | "prompt" | null;
}): ComposeModeTileSheet | null {
  if (input.mode === "photoshoot") return null;
  if (input.mode === "photo_prompt") {
    if (!input.alreadyInMode) return "photos";
    return input.currentSheet === "photos" ? null : "photos";
  }
  if (!input.alreadyInMode) return "model";
  return input.currentSheet === "model" ? null : "model";
}

/** Photoshoot / photo_prompt must not enqueue a regular image/video job. */
export function canEnqueueWhilePhotoshootSelected(input: {
  composeMode: GenerateComposeMode;
  editKind?: string | null;
}): boolean {
  if (input.composeMode === "photo_prompt") return false;
  if (input.composeMode !== "photoshoot") return true;
  return input.editKind === PHOTOSHOOT_EDIT_KIND;
}
