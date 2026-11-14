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
  composePhotoPickerGuideCopy,
  composeToolGuideCopy,
  composeToolGuideHidesPromptStrip,
  composeToolGuideVisible,
} from "./compose-tool-guide";

test("all 6 tool explainers share a unified structure: concise title, 1-sentence lead, 2 spec chips, and input->output badges", () => {
  const allGuides = [
    composeToolGuideCopy("image"),
    composeToolGuideCopy("video"),
    composeToolGuideCopy("photoshoot"),
    composeToolGuideCopy("sticker", { stickerKind: "single" }),
    composeToolGuideCopy("sticker", { stickerKind: "pack" }),
    composeToolGuideCopy("photo_prompt"),
  ];

  assert.equal(allGuides[0], COMPOSE_IMAGE_GUIDE);
  assert.equal(allGuides[1], COMPOSE_VIDEO_GUIDE);
  assert.equal(allGuides[2], COMPOSE_PHOTOSHOOT_GUIDE);
  assert.equal(allGuides[3], COMPOSE_STICKER_GUIDE);
  assert.equal(allGuides[4], COMPOSE_STICKER_PACK_GUIDE);
  assert.equal(allGuides[5], COMPOSE_PHOTO_PROMPT_GUIDE);

  for (const guide of allGuides) {
    assert.ok(
      guide.title.length >= 10 && guide.title.length <= 32,
      `${guide.title}: title fits one clean line`,
    );
    assert.ok(
      guide.lead.length >= 30 && guide.lead.length <= 105,
      `${guide.lead}: lead is a single clear sentence`,
    );
    assert.equal(guide.chips.length, 2, `${guide.title}: has 2 spec chips`);
    assert.ok(guide.inputBadge.length > 0 && guide.outputBadge.length > 0);
  }

  // Specific semantic anchors per tool
  assert.equal(COMPOSE_PHOTOSHOOT_GUIDE.visual, "source-to-tiles");
  assert.match(COMPOSE_PHOTOSHOOT_GUIDE.title, /4 кадр/i);
  assert.equal(COMPOSE_PHOTO_PROMPT_GUIDE.visual, "prompt-from-photo");
  assert.equal(COMPOSE_PHOTO_PROMPT_GUIDE.chips[0].tone, "positive");
  assert.equal(COMPOSE_PHOTO_PROMPT_GUIDE.chips[1].tone, "muted");
  assert.equal(COMPOSE_STICKER_GUIDE.visual, "sticker-cutout");
  assert.match(COMPOSE_STICKER_GUIDE.lead, /питомец/i);
  assert.equal(COMPOSE_STICKER_PACK_GUIDE.visual, "sticker-pack");
  assert.match(COMPOSE_STICKER_PACK_GUIDE.title, /16 стикеров/i);

  // Photo picker guidance is tailored per tool without portrait-only bans on stickers/video/prompt
  assert.match(COMPOSE_STICKER_PICKER_GUIDE.title, /картинк/i);
  assert.doesNotMatch(COMPOSE_STICKER_PICKER_GUIDE.lead, /один человек/i);
  assert.match(composePhotoPickerGuideCopy("photo_prompt").title, /референс/i);
  assert.match(composePhotoPickerGuideCopy("video").title, /видео/i);
  assert.match(
    composePhotoPickerGuideCopy("image", { isDock: true }).lead,
    /Далее/,
  );
});

test("empty-plate guide shows only for idle photoshoot / photo_prompt / sticker", () => {
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
      composeMode: "video",
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
