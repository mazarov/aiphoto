/**
 * Copy + pure state for the sticker result actions («Эмоция», «Движение», «Текст»).
 * Kept out of the component so the labels and the submit gate are unit-testable.
 */

import {
  STICKER_CUSTOM_HINT_MIN,
  STICKER_TEXT_ACTION,
  STICKER_TEXT_MAX_CHARS,
  normalizeStickerOverlayText,
  sanitizeStickerCustomHint,
  type StickerEditAction,
} from "./sticker";

export type StickerResultAction = StickerEditAction | typeof STICKER_TEXT_ACTION;

export const STICKER_ACTION_COPY: Record<
  StickerResultAction,
  {
    railLabel: string;
    title: string;
    lead: string;
    customPlaceholder: string;
    cta: string;
    busy: string;
  }
> = {
  emotion: {
    railLabel: "Эмоция",
    title: "Изменить эмоцию",
    lead: "Тот же стикер, другое выражение лица.",
    customPlaceholder: "Или опишите свою эмоцию",
    cta: "Изменить эмоцию",
    busy: "Меняем…",
  },
  motion: {
    railLabel: "Движение",
    title: "Изменить движение",
    lead: "Тот же стикер, другой жест или поза.",
    customPlaceholder: "Или опишите своё движение",
    cta: "Изменить движение",
    busy: "Меняем…",
  },
  text: {
    railLabel: "Текст",
    title: "Добавить текст",
    lead: `Подпись на белой плашке снизу, до ${STICKER_TEXT_MAX_CHARS} символов. Бесплатно.`,
    customPlaceholder: "Например: Доброе утро",
    cta: "Добавить текст",
    busy: "Добавляем…",
  },
};

/** «Обводка» has no presets/text — its own sheet (`StickerBorderSheet`) with a px control. */
export const STICKER_BORDER_COPY = {
  railLabel: "Обводка",
  title: "Добавить обводку",
  lead: "Белый контур вокруг фигуры, как на стикерах в Telegram. Бесплатно.",
  sliderLabel: "Толщина обводки, px",
  cta: "Добавить",
  busy: "Добавляем…",
} as const;

export const STICKER_ACTION_FREE_DETAIL = "бесплатно";
export const STICKER_ACTION_EXIT = "Выйти";

/** Emotion / motion: a preset or ≥ 2-char custom hint. Text: ≥ 1 char after normalisation. */
export function stickerActionCanSubmit(input: {
  action: StickerResultAction;
  presetId: string | null;
  customText: string;
  busy?: boolean;
}): boolean {
  if (input.busy) return false;
  if (input.action === STICKER_TEXT_ACTION) {
    return normalizeStickerOverlayText(input.customText).length > 0;
  }
  if (input.presetId) return true;
  return sanitizeStickerCustomHint(input.customText).length >= STICKER_CUSTOM_HINT_MIN;
}

export function stickerActionCtaLabel(input: {
  action: StickerResultAction;
  busy: boolean;
  progress?: number;
  creditCost: number | null;
  hideCreditCost?: boolean;
}): string {
  const copy = STICKER_ACTION_COPY[input.action];
  if (input.busy) {
    return input.progress && input.progress > 0 ? `${copy.busy} ${Math.round(input.progress)}%` : copy.busy;
  }
  if (input.action === STICKER_TEXT_ACTION || input.hideCreditCost || input.creditCost == null) {
    return copy.cta;
  }
  return `${copy.cta} ${input.creditCost}✦`;
}
