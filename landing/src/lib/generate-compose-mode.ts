import { displayLabelForGenerationModel } from "./generation-model-labels";
import {
  GPT_IMAGE_25_FLARE_CREDIT_COST,
  GPT_IMAGE_25_FLARE_IMAGE_MODEL,
} from "./generation/image-options";
import { PHOTOSHOOT_EDIT_KIND } from "./photoshoot";
import { STICKER_EDIT_KIND } from "./sticker";
import { STICKER_PACK_EDIT_KIND } from "./sticker-pack";

/** Exclusive generate-dock mode. Photoshoot / photo_prompt / sticker are buttons, not model sheets. */
export type GenerateComposeMode =
  | "image"
  | "video"
  | "photoshoot"
  | "photo_prompt"
  | "sticker";

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

export const STICKER_NEEDS_LIBRARY_PHOTO = "Для стикера выберите одно фото";

export const PHOTOSHOOT_NEEDS_READY_FRAME = PHOTOSHOOT_NEEDS_LIBRARY_PHOTO;

export function isGenerateComposeMode(value: unknown): value is GenerateComposeMode {
  return (
    value === "image" ||
    value === "video" ||
    value === "photoshoot" ||
    value === "photo_prompt" ||
    value === "sticker"
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

/**
 * One source photo is picked for photoshoot / sticker — library row or a guest's
 * in-browser upload (no `storagePath` until sign-in). Drives the footer label only;
 * enqueue still needs `resolvePhotoshootLibraryFrame`.
 */
export function composeHasSingleSourcePhoto(input: {
  selectedPhotos: Array<{ id?: string | null; storagePath?: string | null; previewUrl?: string | null }>;
}): boolean {
  if (input.selectedPhotos.length !== 1) return false;
  const photo = input.selectedPhotos[0];
  if (!photo.id?.trim()) return false;
  return Boolean(photo.storagePath?.trim() || photo.previewUrl?.trim());
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

/** Tools row: «Ваши фото» → «Инструмент» → the tool's own tiles. */
export const COMPOSE_TOOL_EDGE_LABEL = "Инструмент";
export const COMPOSE_STYLE_TOOL_EDGE_LABEL = "Стиль";
export const COMPOSE_MODEL_TOOL_EDGE_LABEL = "Модель";
export const COMPOSE_TOOL_SHEET_TITLE = "Инструмент";
export const COMPOSE_TOOL_SHEET_DONE_CTA = "Готово";

/** Order of buttons in the «Инструмент» sheet. Flags drop the ones that are off. */
export const COMPOSE_TOOL_ORDER: readonly GenerateComposeMode[] = [
  "image",
  "video",
  "photoshoot",
  "sticker",
  "photo_prompt",
];

export function composeToolOptions(flags: {
  videoEnabled: boolean;
  photoshootEnabled: boolean;
  stickerEnabled: boolean;
  /** Already picked tool stays listed even if its flag is off (seeded sticker before config arrives). */
  current?: GenerateComposeMode;
}): GenerateComposeMode[] {
  return COMPOSE_TOOL_ORDER.filter((mode) => {
    if (mode === flags.current) return true;
    if (mode === "video") return flags.videoEnabled;
    if (mode === "photoshoot") return flags.photoshootEnabled;
    if (mode === "sticker") return flags.stickerEnabled;
    return true;
  });
}

export type ComposeSecondaryTool = "style" | "model";

/**
 * Tiles that appear next to «Инструмент» once a tool is picked.
 * Photo: style + model. Video: model. Sticker: style (its model is fixed). Photoshoot / photo prompt: nothing.
 */
export function composeSecondaryTools(mode: GenerateComposeMode): ComposeSecondaryTool[] {
  if (mode === "image") return ["style", "model"];
  if (mode === "video") return ["model"];
  if (mode === "sticker") return ["style"];
  return [];
}

/** «Стикер» tool has two kinds. Pack style and pack set are both picked in the «Стиль» sheet. */
export type StickerToolKind = "single" | "pack";
export const STICKER_TOOL_KINDS: readonly StickerToolKind[] = ["single", "pack"];
export function stickerToolKindLabel(kind: StickerToolKind): string {
  return kind === "pack" ? "Стикер пак" : "Стикер";
}
export const STICKER_PACK_SOON_CTA = "Стикер пак — скоро";
export const STICKER_PACK_CREATE_CTA = "Создать стикер пак";

/**
 * Pack footer stays «скоро» until this viewer may enqueue.
 * `enqueueEnabled` is `stickerPackEnabled` from generation-config (flag or allowlist).
 */
export function composeCtaDisabledForStickerPack(input: {
  composeMode: GenerateComposeMode;
  stickerKind: StickerToolKind;
  enqueueEnabled?: boolean;
}): boolean {
  if (input.composeMode !== "sticker" || input.stickerKind !== "pack") return false;
  return input.enqueueEnabled !== true;
}

/** Caption on the «Инструмент» tile. */
export function composeToolTileBodyLabel(input: {
  composeMode: GenerateComposeMode;
  stickerKind: StickerToolKind;
}): string {
  if (input.composeMode === "sticker") return stickerToolKindLabel(input.stickerKind);
  return composeModeTileLabel(input.composeMode);
}

/** Mode tile caption. Library preview stays on the «Ваши фото» tile. */
export function composeModeTileLabel(mode: GenerateComposeMode): string {
  if (mode === "video") return "Видео";
  if (mode === "photoshoot") return "Фотосессии";
  if (mode === "photo_prompt") return "Промт по фото";
  if (mode === "sticker") return "Стикер";
  return "Фото";
}

/** Top-border pill on the library photos tool tile. */
export const COMPOSE_PHOTOS_TOOL_EDGE_LABEL = "Ваши фото";

export function composePhotosToolCountLabel(selected: number, cap: number): string {
  return `${selected}/${cap}`;
}

/** Photo tile body when the first image job still has no model. */
export const COMPOSE_TOOL_TILE_UNSET_LABEL = "Выбрать";

/** Dock seed → first compose chip. resume / text / result stay on photo. */
export function composeModeFromDockIntent(intent: string): GenerateComposeMode {
  if (intent === "animate") return "video";
  if (intent === "photo_prompt") return "photo_prompt";
  if (intent === "photoshoot") return "photoshoot";
  if (intent === "sticker") return "sticker";
  return "image";
}

/** Guest footer CTA: pick photo/video first, sign in only on enqueue. */
export const COMPOSE_GUEST_SIGN_IN_CTA = "Войдите";
export const COMPOSE_SELECT_PHOTO_CTA = "Выберите фото";
export const COMPOSE_GUEST_UPLOAD_PHOTO_CTA = "Загрузите фото";
/** Sticker takes any picture (pet, meme, drawing), so the CTA does not say «фото». */
export const COMPOSE_STICKER_SELECT_PICTURE_CTA = "Выберите картинку";
export const COMPOSE_STICKER_GUEST_UPLOAD_PICTURE_CTA = "Добавьте картинку";

export type ComposeGenerateCtaOptions = {
  isAuthed?: boolean;
  listingVideoRepeat?: boolean;
};

/** Footer when the selected tool still needs a source photo. */
export function composeNeedsPhotoCtaLabel(
  mode: GenerateComposeMode,
  options?: ComposeGenerateCtaOptions,
): string {
  if (mode === "sticker") {
    return options?.isAuthed === false
      ? COMPOSE_STICKER_GUEST_UPLOAD_PICTURE_CTA
      : COMPOSE_STICKER_SELECT_PICTURE_CTA;
  }
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
  if (mode === "sticker") return "Создать стикер";
  return "Создать фото";
}

/** Paywall CTA: next action, not an error. Compact label is for the mobile tab and result rail. */
/** Prompt field copy — one source for the dock editor and the SEO hero starter. */
export const BLANK_PROMPT_PLACEHOLDER = "Опишите изображение или референс";
export const PROMPT_FIELD_LABEL = "Промт";
export const PROMPT_FIELD_MAX_LENGTH = 8000;

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

/** Sticker footer: GPT Image 2.5 and its credit price, before config arrives too. */
export function stickerStudioCta(input: {
  modelId?: string | null;
  cost?: number | null;
}): { modelLabel: string; cost: number } {
  const modelId = input.modelId?.trim() || GPT_IMAGE_25_FLARE_IMAGE_MODEL;
  const cost =
    typeof input.cost === "number" && Number.isFinite(input.cost)
      ? input.cost
      : GPT_IMAGE_25_FLARE_CREDIT_COST;
  return {
    modelLabel: displayLabelForGenerationModel(modelId, "GPT Image 2.5"),
    cost,
  };
}

/** Photoshoot / photo_prompt / sticker must not enqueue a regular image/video job. */
export function canEnqueueWhilePhotoshootSelected(input: {
  composeMode: GenerateComposeMode;
  editKind?: string | null;
}): boolean {
  if (input.composeMode === "photo_prompt") return false;
  if (input.composeMode === "sticker") {
    return (
      input.editKind === STICKER_EDIT_KIND ||
      input.editKind === STICKER_PACK_EDIT_KIND
    );
  }
  if (input.composeMode !== "photoshoot") return true;
  return input.editKind === PHOTOSHOOT_EDIT_KIND;
}
