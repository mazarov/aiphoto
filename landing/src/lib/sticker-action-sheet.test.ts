import assert from "node:assert/strict";
import test from "node:test";
import {
  STICKER_ACTION_COPY,
  stickerActionCanSubmit,
  stickerActionCtaLabel,
} from "./sticker-action-sheet";
import { pluralStyles } from "./plural-prompts";
import { stickerStylesTitle } from "./stiker-iz-foto-seo-copy";

test("sticker action submit gate: preset or custom hint for emotion/motion, text for text", () => {
  assert.equal(stickerActionCanSubmit({ action: "emotion", presetId: "happy", customText: "" }), true);
  assert.equal(stickerActionCanSubmit({ action: "emotion", presetId: null, customText: "x" }), false);
  assert.equal(stickerActionCanSubmit({ action: "motion", presetId: null, customText: "машет рукой" }), true);
  assert.equal(stickerActionCanSubmit({ action: "motion", presetId: "wave", customText: "", busy: true }), false);
  assert.equal(stickerActionCanSubmit({ action: "text", presetId: null, customText: "   " }), false);
  assert.equal(stickerActionCanSubmit({ action: "text", presetId: null, customText: " Привет " }), true);
});

test("sticker action CTA: cost badge only for paid actions, busy shows progress", () => {
  assert.equal(stickerActionCtaLabel({ action: "emotion", busy: false, creditCost: 5 }), "Изменить эмоцию 5✦");
  assert.equal(
    stickerActionCtaLabel({ action: "emotion", busy: false, creditCost: 5, hideCreditCost: true }),
    "Изменить эмоцию",
  );
  assert.equal(stickerActionCtaLabel({ action: "text", busy: false, creditCost: 5 }), "Добавить текст");
  assert.equal(stickerActionCtaLabel({ action: "motion", busy: true, progress: 42, creditCost: 5 }), "Меняем… 42%");
  assert.equal(STICKER_ACTION_COPY.text.railLabel, "Текст");
});

test("sticker styles H2 follows the live count", () => {
  assert.equal(pluralStyles(1), "1 стиль");
  assert.equal(pluralStyles(3), "3 стиля");
  assert.equal(pluralStyles(11), "11 стилей");
  assert.equal(pluralStyles(22), "22 стиля");
  assert.equal(stickerStylesTitle(14), "Нейросеть для стикеров: 14 стилей");
  assert.equal(stickerStylesTitle(0), "Нейросеть для стикеров: 6 стилей");
});
