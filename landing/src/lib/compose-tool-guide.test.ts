import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPOSE_IMAGE_GUIDE,
  COMPOSE_PHOTO_PROMPT_GUIDE,
  COMPOSE_PHOTOSHOOT_GUIDE,
  COMPOSE_STICKER_GUIDE,
  COMPOSE_STICKER_PACK_GUIDE,
  COMPOSE_STICKER_PICKER_GUIDE,
  COMPOSE_VIDEO_GUIDE,
  composeToolGuideCopy,
  composeToolGuideHidesPromptStrip,
  composeToolGuideVisible,
} from "./compose-tool-guide";
import { widgetCopy } from "./foto-v-promt-copy";

test("photoshoot and photo_prompt have a three-beat explainer like the photo picker", () => {
  const shoot = composeToolGuideCopy("photoshoot");
  const prompt = composeToolGuideCopy("photo_prompt");
  assert.equal(shoot?.title, COMPOSE_PHOTOSHOOT_GUIDE.title);
  assert.equal(shoot?.visual, "source-to-tiles");
  assert.match(shoot?.lead ?? "", /одно фото/i);
  assert.match(shoot?.lead ?? "", /четыре кадра/i);
  assert.match(shoot?.hint ?? "", /одно фото/i);
  assert.equal(prompt?.title, widgetCopy("emptyTitle"));
  assert.equal(prompt?.lead, widgetCopy("emptyLead"));
  assert.equal(prompt?.hint, widgetCopy("emptyHint"));
  assert.equal(prompt?.visual, "prompt-from-photo");
  assert.equal(prompt?.title, COMPOSE_PHOTO_PROMPT_GUIDE.title);
  const sticker = composeToolGuideCopy("sticker");
  assert.equal(sticker, COMPOSE_STICKER_GUIDE);
  assert.equal(sticker?.visual, "sticker-cutout");
  // Sticker guide: one accent (the example sticker), two short lines, no hint, no portrait-only wording.
  assert.match(sticker?.title ?? "", /любая картинка/i);
  assert.match(sticker?.lead ?? "", /питомец/i);
  assert.equal(sticker?.hint, "");
  assert.ok((sticker?.title.length ?? 0) <= 30, "title fits one line on the plate");
  assert.ok((sticker?.lead.length ?? 0) <= 60, "lead is one short line");
  assert.doesNotMatch(sticker?.lead ?? "", /обводк/i);
  assert.match(COMPOSE_STICKER_PICKER_GUIDE.title, /картинку/i);
  assert.match(COMPOSE_STICKER_PICKER_GUIDE.lead, /питомец/i);
  assert.ok(COMPOSE_STICKER_PICKER_GUIDE.lead.length <= 60, "picker lead is one short line");
  assert.doesNotMatch(COMPOSE_STICKER_PICKER_GUIDE.lead, /один человек/i);
});

test("every tool has a guide for the «Инструмент» sheet; photo / video / pack are one picture + one line", () => {
  const image = composeToolGuideCopy("image");
  const video = composeToolGuideCopy("video");
  assert.equal(image, COMPOSE_IMAGE_GUIDE);
  assert.equal(video, COMPOSE_VIDEO_GUIDE);
  assert.equal(image.visual, "photo-frame");
  assert.equal(video.visual, "video-frame");
  for (const guide of [image, video, COMPOSE_STICKER_PACK_GUIDE]) {
    assert.equal(guide.hint, "");
    assert.ok(guide.title.length <= 30, `${guide.title}: title fits one line`);
    assert.ok(guide.lead.length <= 64, `${guide.lead}: lead is one short line`);
  }
  // Pack uses the same style picture as a single sticker. The set is picked in the «Стиль» sheet.
  assert.equal(composeToolGuideCopy("sticker", { stickerKind: "single" }), COMPOSE_STICKER_GUIDE);
  const pack = composeToolGuideCopy("sticker", { stickerKind: "pack" });
  assert.equal(pack, COMPOSE_STICKER_PACK_GUIDE);
  assert.equal(pack.visual, "sticker-cutout");
  assert.match(pack.title, /16 стикеров/i);
  assert.match(pack.lead, /стиль/i);
  // Plate rules do not change: photo and video keep the prompt strip there.
  assert.equal(
    composeToolGuideVisible({ composeMode: "image", showResultChrome: false, dockExpanded: false }),
    false,
  );
  assert.equal(
    composeToolGuideVisible({ composeMode: "video", showResultChrome: false, dockExpanded: false }),
    false,
  );
});

test("empty-plate guide shows only for idle photoshoot / photo_prompt", () => {
  assert.equal(
    composeToolGuideVisible({
      composeMode: "photoshoot",
      showResultChrome: false,
      dockExpanded: false,
    }),
    true,
  );
  assert.equal(
    composeToolGuideVisible({
      composeMode: "photo_prompt",
      showResultChrome: false,
      dockExpanded: false,
    }),
    true,
  );
  assert.equal(
    composeToolGuideVisible({
      composeMode: "sticker",
      showResultChrome: false,
      dockExpanded: false,
    }),
    true,
  );
  assert.equal(
    composeToolGuideVisible({
      composeMode: "image",
      showResultChrome: false,
      dockExpanded: false,
    }),
    false,
  );
  assert.equal(
    composeToolGuideVisible({
      composeMode: "photoshoot",
      showResultChrome: true,
      dockExpanded: false,
    }),
    false,
  );
  assert.equal(
    composeToolGuideVisible({
      composeMode: "photo_prompt",
      showResultChrome: false,
      dockExpanded: true,
    }),
    false,
  );
  assert.equal(
    composeToolGuideVisible({
      composeMode: "photoshoot",
      showResultChrome: false,
      dockExpanded: false,
      busy: true,
    }),
    false,
  );
});

test("tool guide hides the unused prompt strip", () => {
  assert.equal(
    composeToolGuideHidesPromptStrip({
      composeMode: "photoshoot",
      promptExpanded: false,
    }),
    true,
  );
  assert.equal(
    composeToolGuideHidesPromptStrip({
      composeMode: "photo_prompt",
      promptExpanded: true,
    }),
    false,
  );
  assert.equal(
    composeToolGuideHidesPromptStrip({
      composeMode: "sticker",
      promptExpanded: false,
    }),
    true,
  );
  assert.equal(
    composeToolGuideHidesPromptStrip({
      composeMode: "image",
      promptExpanded: false,
    }),
    false,
  );
});
