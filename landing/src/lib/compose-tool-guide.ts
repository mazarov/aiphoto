import type { GenerateComposeMode, StickerToolKind } from "./generate-compose-mode";

export type ComposeToolGuideChip = {
  label: string;
  tone?: "default" | "positive" | "muted";
};

export type ComposeToolGuideCopy = {
  title: string;
  lead: string;
  /** Legacy single-line hint (kept empty or concise for backwards compatibility). */
  hint: string;
  /** Unified 2-pill spec row shown under `lead` across every tool explainer. */
  chips: readonly [ComposeToolGuideChip, ComposeToolGuideChip];
  /** Short labels on the Input -> Output visual stage. */
  inputBadge: string;
  outputBadge: string;
  visual:
    | "source-to-tiles"
    | "prompt-from-photo"
    | "sticker-cutout"
    | "sticker-pack"
    | "photo-frame"
    | "video-frame";
};

export type ComposePhotoPickerGuideCopy = {
  title: string;
  lead: string;
};

/** «Инструмент» — Фото (`image`). */
export const COMPOSE_IMAGE_GUIDE: ComposeToolGuideCopy = {
  title: "Фото в любом образе",
  lead: "Примерьте образ на своё селфи с сохранением черт лица или создайте кадр с нуля по описанию.",
  hint: "",
  chips: [
    { label: "Фото — по желанию" },
    { label: "78 000+ образов" },
  ],
  inputBadge: "Селфи",
  outputBadge: "Образ",
  visual: "photo-frame",
};

/** «Инструмент» — Видео (`video`). */
export const COMPOSE_VIDEO_GUIDE: ComposeToolGuideCopy = {
  title: "Живое видео из фото",
  lead: "Загрузите один снимок и добавьте пару слов о движении — нейросеть плавно оживит сцену.",
  hint: "",
  chips: [
    { label: "Нужно 1 фото" },
    { label: "Ролик 5–10 сек" },
  ],
  inputBadge: "1 фото",
  outputBadge: "5–10 с",
  visual: "video-frame",
};

/** «Инструмент» — Фотосессии (`photoshoot`). */
export const COMPOSE_PHOTOSHOOT_GUIDE: ComposeToolGuideCopy = {
  title: "Серия из 4 кадров",
  lead: "Одно чёткое фото превратится в 4 разных ракурса и позы с сохранением вашей внешности.",
  hint: "1 фото крупным планом, без групп и очков",
  chips: [
    { label: "1 фото анфас" },
    { label: "4 кадра сразу" },
  ],
  inputBadge: "1 фото",
  outputBadge: "4 кадра",
  visual: "source-to-tiles",
};

/** «Инструмент» — Стикер (`sticker`, single). */
export const COMPOSE_STICKER_GUIDE: ComposeToolGuideCopy = {
  title: "Стикер из любой картинки",
  lead: "Подойдёт селфи, питомец или мем — перерисуем в выбранном стиле и аккуратно уберём фон.",
  hint: "",
  chips: [
    { label: "Любой объект или мем" },
    { label: "PNG без фона" },
  ],
  inputBadge: "Картинка",
  outputBadge: "Без фона",
  visual: "sticker-cutout",
};

/** «Инструмент» — Стикер пак (`sticker`, pack). */
export const COMPOSE_STICKER_PACK_GUIDE: ComposeToolGuideCopy = {
  title: "Набор из 16 стикеров",
  lead: "Загрузите одно фото и выберите стиль — соберём целый пак из 16 разных эмоций без фона.",
  hint: "",
  chips: [
    { label: "1 фото лица" },
    { label: "16 эмоций в паке" },
  ],
  inputBadge: "1 фото",
  outputBadge: "16 шт.",
  visual: "sticker-pack",
};

/** «Инструмент» — Промт по фото (`photo_prompt`). */
export const COMPOSE_PHOTO_PROMPT_GUIDE: ComposeToolGuideCopy = {
  title: "Готовый промт по картинке",
  lead: "Загрузите понравившийся кадр из Pinterest или соцсетей — разберём свет, ракурс и детали в текст.",
  hint: "JPG, PNG или WebP · до 10 МБ",
  chips: [
    { label: "Референс из сети", tone: "positive" },
    { label: "Не своё селфи", tone: "muted" },
  ],
  inputBadge: "Референс",
  outputBadge: "Промт",
  visual: "prompt-from-photo",
};

/** Backwards-compatible sticker picker copy export. */
export const COMPOSE_STICKER_PICKER_GUIDE: ComposePhotoPickerGuideCopy = {
  title: "Подойдёт любая картинка",
  lead: "Селфи, питомец, предмет или мем — перерисуем в стикер и уберём фон.",
};

/** Unified guidance copy inside the «Ваши фото» step tailored to each tool. */
export function composePhotoPickerGuideCopy(
  mode: GenerateComposeMode,
  options?: { stickerKind?: StickerToolKind; isDock?: boolean },
): ComposePhotoPickerGuideCopy {
  if (mode === "sticker") {
    if (options?.stickerKind === "pack") {
      return {
        title: "Добавьте одно фото лица",
        lead: "Крупный план при хорошем свете — соберём 16 стикеров с разными эмоциями.",
      };
    }
    return COMPOSE_STICKER_PICKER_GUIDE;
  }
  if (mode === "photo_prompt") {
    return {
      title: "Загрузите картинку-референс",
      lead: "Понравившийся кадр из Pinterest, Instagram или сайта — напишем готовый промт.",
    };
  }
  if (mode === "video") {
    return {
      title: "Какой кадр подойдёт для видео",
      lead: "Выберите одно чёткое фото без смаза — портрет, пару или сцену в движении.",
    };
  }
  if (mode === "photoshoot") {
    return {
      title: "Какое фото нужно для серии",
      lead: "Один человек, лицо крупно и без очков — чтобы все 4 ракурса сохранили черты.",
    };
  }
  return {
    title: "Какое фото добавить",
    lead: options?.isDock
      ? "Один человек, лицо крупно и без очков. Или нажмите «Далее», чтобы создать без фото."
      : "Один человек, лицо крупно и хорошо освещено — без групп, очков и съёмки издалека.",
  };
}

/** Every tool has a unified guide for the «Инструмент» sheet. */
export function composeToolGuideCopy(
  mode: GenerateComposeMode,
  options?: { stickerKind?: StickerToolKind },
): ComposeToolGuideCopy {
  if (mode === "photoshoot") return COMPOSE_PHOTOSHOOT_GUIDE;
  if (mode === "photo_prompt") return COMPOSE_PHOTO_PROMPT_GUIDE;
  if (mode === "sticker") {
    return options?.stickerKind === "pack"
      ? COMPOSE_STICKER_PACK_GUIDE
      : COMPOSE_STICKER_GUIDE;
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
