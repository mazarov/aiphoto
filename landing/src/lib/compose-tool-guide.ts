import { widgetCopy } from "./foto-v-promt-copy";
import type { GenerateComposeMode, StickerToolKind } from "./generate-compose-mode";

export type ComposeToolGuideCopy = {
  title: string;
  lead: string;
  hint: string;
  visual:
    | "source-to-tiles"
    | "prompt-from-photo"
    | "sticker-cutout"
    | "photo-frame"
    | "video-frame";
};

/** «Инструмент» sheet, Фото picked: one frame, the action, one line. Plate keeps the prompt strip. */
export const COMPOSE_IMAGE_GUIDE: ComposeToolGuideCopy = {
  title: "Фото по описанию",
  lead: "Опишите кадр или выберите стиль. Своё фото — по желанию.",
  hint: "",
  visual: "photo-frame",
};

/** «Инструмент» sheet, Видео picked. */
export const COMPOSE_VIDEO_GUIDE: ComposeToolGuideCopy = {
  title: "Оживите фото",
  lead: "Одно фото и пара слов о движении — получится ролик.",
  hint: "",
  visual: "video-frame",
};

/**
 * «Стикер» → «Стикер пак». The picture is the style picked on the «Стиль» button
 * (same sticker example as the single kind). The pack set is chosen in that sheet too.
 */
export const COMPOSE_STICKER_PACK_GUIDE: ComposeToolGuideCopy = {
  title: "16 стикеров с одного фото",
  lead: "Один стиль на все 16 — кнопка «Стиль».",
  hint: "",
  visual: "sticker-cutout",
};

/** Empty-plate explainer when Фотосессии is selected. Same beat as «Какое фото добавить». */
export const COMPOSE_PHOTOSHOOT_GUIDE: ComposeToolGuideCopy = {
  title: "Снимите серию с одного фото",
  lead: "Сначала одно фото. Потом четыре кадра: разные позы, одно лицо.",
  hint: "Нужно одно фото. Лицо крупно, без групп и очков.",
  visual: "source-to-tiles",
};

/**
 * Empty-plate explainer when Стикер is selected.
 * One accent — a real example sticker of the chosen style; two short lines, no steps.
 * `hint` is empty on purpose: the sticker itself is the third beat.
 */
export const COMPOSE_STICKER_GUIDE: ComposeToolGuideCopy = {
  title: "Любая картинка → стикер",
  lead: "Селфи, питомец или мем. Фон уберём сами.",
  hint: "",
  visual: "sticker-cutout",
};

/**
 * Photo picker sheet when Стикер is selected — replaces the generic «Какое фото добавить»
 * (one person, face close) which reads as a ban on pets, memes and drawings.
 * Same shape as the plate: one sticker, title = the action, one line.
 */
export const COMPOSE_STICKER_PICKER_GUIDE = {
  title: "Добавьте картинку",
  lead: "Селфи, питомец или мем — подойдёт любая.",
} as const;

/** Empty-plate explainer when Промт по фото is selected — same copy as /foto-v-promt. */
export const COMPOSE_PHOTO_PROMPT_GUIDE: ComposeToolGuideCopy = {
  title: widgetCopy("emptyTitle"),
  lead: widgetCopy("emptyLead"),
  hint: widgetCopy("emptyHint"),
  visual: "prompt-from-photo",
};

/** Every tool has a guide for the «Инструмент» sheet. The plate shows only the ones in `composeToolGuideVisible`. */
export function composeToolGuideCopy(
  mode: GenerateComposeMode,
  options?: { stickerKind?: StickerToolKind },
): ComposeToolGuideCopy {
  if (mode === "photoshoot") return COMPOSE_PHOTOSHOOT_GUIDE;
  if (mode === "photo_prompt") return COMPOSE_PHOTO_PROMPT_GUIDE;
  if (mode === "sticker") {
    return options?.stickerKind === "pack" ? COMPOSE_STICKER_PACK_GUIDE : COMPOSE_STICKER_GUIDE;
  }
  if (mode === "video") return COMPOSE_VIDEO_GUIDE;
  return COMPOSE_IMAGE_GUIDE;
}

/** Idle plate guide: photoshoot / photo_prompt / sticker. Photo and video keep the prompt strip there. */
export function composeToolGuideVisible(input: {
  composeMode: GenerateComposeMode;
  showResultChrome: boolean;
  dockExpanded: boolean;
  busy?: boolean;
}): boolean {
  if (input.showResultChrome || input.dockExpanded || input.busy) return false;
  return (
    input.composeMode === "photoshoot" ||
    input.composeMode === "photo_prompt" ||
    input.composeMode === "sticker"
  );
}

/** Prompt strip is unused in these tools — the empty plate is the explainer. */
export function composeToolGuideHidesPromptStrip(input: {
  composeMode: GenerateComposeMode;
  promptExpanded: boolean;
}): boolean {
  if (input.promptExpanded) return false;
  return (
    input.composeMode === "photoshoot" ||
    input.composeMode === "photo_prompt" ||
    input.composeMode === "sticker"
  );
}
