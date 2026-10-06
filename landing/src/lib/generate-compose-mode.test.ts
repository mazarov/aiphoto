import assert from "node:assert/strict";
import test from "node:test";
import { PHOTOSHOOT_EDIT_KIND } from "./photoshoot";
import { STICKER_EDIT_KIND } from "./sticker";
import {
  apiModalityForComposeMode,
  canEnqueueWhilePhotoshootSelected,
  resolveStickerFromResultFrame,
  COMPOSE_BUY_CREDITS_CTA,
  COMPOSE_BUY_CREDITS_CTA_COMPACT,
  COMPOSE_EDIT_RESULT_CTA,
  resultChromeHidesComposeFooter,
  resultChromeHidesPromptStrip,
  resultPrimaryAction,
  COMPOSE_GUEST_SIGN_IN_CTA,
  composeGenerateCtaLabel,
  COMPOSE_SAVE_PROMPT_CTA,
  COMPOSE_SAVING_PROMPT_CTA,
  composeGenerateCtaShowsModelName,
  composeModeFromDockIntent,
  composeModeTileLabel,
  COMPOSE_PHOTOS_TOOL_EDGE_LABEL,
  composePhotosToolCountLabel,
  COMPOSE_TOOL_TILE_UNSET_LABEL,
  composeNeedsPhotoCtaLabel,
  COMPOSE_GUEST_UPLOAD_PHOTO_CTA,
  COMPOSE_SELECT_PHOTO_CTA,
  COMPOSE_STICKER_GUEST_UPLOAD_PICTURE_CTA,
  COMPOSE_STICKER_SELECT_PICTURE_CTA,
  COMPOSE_TOOL_EDGE_LABEL,
  COMPOSE_STYLE_TOOL_EDGE_LABEL,
  COMPOSE_MODEL_TOOL_EDGE_LABEL,
  COMPOSE_TOOL_SHEET_DONE_CTA,
  COMPOSE_TOOL_ORDER,
  composeToolOptions,
  composeSecondaryTools,
  STICKER_TOOL_KINDS,
  stickerToolKindLabel,
  STICKER_PACK_SOON_CTA,
  STICKER_PACK_CREATE_CTA,
  composeCtaDisabledForStickerPack,
  composeToolTileBodyLabel,
  stickerStudioCta,
  promptModalityForComposeMode,
  rememberCompletedImageResult,
  composeHasSingleSourcePhoto,
  resolvePhotoshootLibraryFrame,
  resolvePhotoshootReadyFrame,
  showBlankPromptRemixBlock,
  PROMPT_REMIX_MIN_PROMPT_CHARS,
} from "./generate-compose-mode";

test("blank compose shows «Что изменить?» only for an image prompt long enough to remix", () => {
  const base = { useBlankPromptEditor: true, videoCompose: false };
  assert.equal(showBlankPromptRemixBlock({ ...base, promptLength: 0 }), false);
  assert.equal(
    showBlankPromptRemixBlock({ ...base, promptLength: PROMPT_REMIX_MIN_PROMPT_CHARS - 1 }),
    false,
  );
  assert.equal(
    showBlankPromptRemixBlock({ ...base, promptLength: PROMPT_REMIX_MIN_PROMPT_CHARS }),
    true,
  );
  assert.equal(showBlankPromptRemixBlock({ ...base, promptLength: 40, videoCompose: true }), false);
  assert.equal(
    showBlankPromptRemixBlock({ ...base, promptLength: 40, useBlankPromptEditor: false }),
    false,
  );
});

test("composeHasSingleSourcePhoto accepts a guest's in-browser photo, enqueue frame does not", () => {
  const guestPhoto = { id: "photo-prompt-ephemeral", storagePath: "", previewUrl: "data:image/jpeg;base64,xx" };
  assert.equal(composeHasSingleSourcePhoto({ selectedPhotos: [guestPhoto] }), true);
  assert.equal(resolvePhotoshootLibraryFrame({ selectedPhotos: [guestPhoto] }), null);
  assert.equal(composeHasSingleSourcePhoto({ selectedPhotos: [] }), false);
  assert.equal(
    composeHasSingleSourcePhoto({ selectedPhotos: [guestPhoto, { id: "b", storagePath: "u/b.jpg" }] }),
    false,
  );
  assert.equal(composeHasSingleSourcePhoto({ selectedPhotos: [{ id: "a", storagePath: "u/a.jpg" }] }), true);
});

test("photoshoot prompt and API modality stay on image", () => {
  assert.equal(promptModalityForComposeMode("photoshoot"), "image");
  assert.equal(apiModalityForComposeMode("photoshoot"), "image");
  assert.equal(apiModalityForComposeMode("video"), "video");
});

test("ready frame prefers the live image result over the last remembered one", () => {
  assert.deepEqual(
    resolvePhotoshootReadyFrame({
      generationId: "live",
      resultUrl: "https://cdn/live.jpg",
      resultModality: "image",
      lastImageResult: { generationId: "old", resultUrl: "https://cdn/old.jpg" },
    }),
    { generationId: "live", resultUrl: "https://cdn/live.jpg" }
  );
});

test("ready frame falls back to the last completed image after compose reset", () => {
  assert.deepEqual(
    resolvePhotoshootReadyFrame({
      generationId: null,
      resultUrl: null,
      resultModality: "image",
      lastImageResult: { generationId: "kept", resultUrl: "https://cdn/kept.jpg" },
    }),
    { generationId: "kept", resultUrl: "https://cdn/kept.jpg" }
  );
});

test("video result is not a photoshoot parent", () => {
  assert.equal(
    resolvePhotoshootReadyFrame({
      generationId: "vid",
      resultUrl: "https://cdn/clip.mp4",
      resultModality: "video",
      lastImageResult: null,
    }),
    null
  );
});

test("remembering a video completion keeps the previous image parent", () => {
  const previous = { generationId: "img", resultUrl: "https://cdn/img.jpg" };
  assert.deepEqual(
    rememberCompletedImageResult({
      generationId: "vid",
      resultUrl: "https://cdn/clip.mp4",
      resultModality: "video",
      previous,
    }),
    previous
  );
});

test("library frame is the selected «Ваши фото» tile, not a generation result", () => {
  assert.equal(resolvePhotoshootLibraryFrame({ selectedPhotos: [] }), null);
  assert.equal(
    resolvePhotoshootLibraryFrame({
      selectedPhotos: [
        { id: "a", storagePath: "user/a.jpg", previewUrl: "https://cdn/a.jpg" },
        { id: "b", storagePath: "user/b.jpg", previewUrl: "https://cdn/b.jpg" },
      ],
    }),
    null,
  );
  assert.deepEqual(
    resolvePhotoshootLibraryFrame({
      selectedPhotos: [
        {
          id: "a",
          storagePath: "user/a.jpg",
          previewUrl: "https://cdn/a.jpg",
          width: 1200,
          height: 1600,
        },
      ],
    }),
    {
      photoId: "a",
      storagePath: "user/a.jpg",
      previewUrl: "https://cdn/a.jpg",
      width: 1200,
      height: 1600,
    },
  );
});

test("compose tiles and generate CTA follow the selected block", () => {
  assert.equal(composeModeTileLabel("image"), "Фото");
  assert.equal(composeModeTileLabel("video"), "Видео");
  assert.equal(composeModeTileLabel("photoshoot"), "Фотосессии");
  assert.equal(composeModeTileLabel("photo_prompt"), "Промт по фото");
  assert.equal(COMPOSE_PHOTOS_TOOL_EDGE_LABEL, "Ваши фото");
  assert.equal(composePhotosToolCountLabel(0, 10), "0/10");
  assert.equal(composePhotosToolCountLabel(2, 1), "2/1");
  assert.equal(COMPOSE_TOOL_TILE_UNSET_LABEL, "Выбрать");
  assert.equal(composeGenerateCtaLabel("image"), "Создать фото");
  assert.equal(composeGenerateCtaLabel("video"), "Создать видео");
  assert.equal(
    composeGenerateCtaLabel("video", { listingVideoRepeat: true }),
    "Повторить видео",
  );
  assert.equal(composeGenerateCtaLabel("photoshoot"), "Создать фотосессию");
  assert.equal(composeGenerateCtaLabel("photo_prompt"), "Создать промт по фото");
  assert.equal(composeGenerateCtaLabel("image", { isAuthed: false }), COMPOSE_GUEST_SIGN_IN_CTA);
  assert.equal(composeGenerateCtaLabel("video", { isAuthed: false }), COMPOSE_GUEST_SIGN_IN_CTA);
  assert.equal(composeGenerateCtaLabel("photoshoot", { isAuthed: false }), COMPOSE_GUEST_SIGN_IN_CTA);
  assert.equal(
    composeGenerateCtaLabel("photo_prompt", { isAuthed: false }),
    "Создать промт по фото",
  );
  assert.equal(composeGenerateCtaShowsModelName("image"), true);
  assert.equal(composeGenerateCtaShowsModelName("video"), true);
  assert.equal(composeGenerateCtaShowsModelName("photoshoot"), false);
  assert.equal(composeGenerateCtaShowsModelName("image", { isAuthed: false }), false);
  assert.equal(COMPOSE_BUY_CREDITS_CTA, "Купить кредиты для создания фото");
  assert.equal(COMPOSE_BUY_CREDITS_CTA_COMPACT, "Купить кредиты");
  assert.equal(COMPOSE_EDIT_RESULT_CTA, "Что изменить");
  assert.equal(
    resultChromeHidesPromptStrip({ showResultChrome: true, promptExpanded: false }),
    true,
  );
  assert.equal(
    resultChromeHidesPromptStrip({ showResultChrome: true, promptExpanded: true }),
    false,
  );
  assert.equal(
    resultChromeHidesComposeFooter({
      showResultActions: true,
      showPhotoPromptResult: false,
    }),
    true,
  );
  assert.deepEqual(resultPrimaryAction({ showCreditsCta: true }), {
    kind: "credits",
    label: COMPOSE_BUY_CREDITS_CTA_COMPACT,
  });
  assert.deepEqual(resultPrimaryAction({ showCreditsCta: false }), {
    kind: "edit",
    label: COMPOSE_EDIT_RESULT_CTA,
  });
  assert.deepEqual(
    resultPrimaryAction({ showCreditsCta: false, remixSaved: true }),
    { kind: "generate", label: composeGenerateCtaLabel("image") },
  );
  assert.deepEqual(resultPrimaryAction({ showCreditsCta: false, stickerResult: true }), {
    kind: "sticker_revise",
    label: COMPOSE_EDIT_RESULT_CTA,
  });
  assert.deepEqual(
    resultPrimaryAction({ showCreditsCta: true, stickerResult: true }),
    { kind: "credits", label: COMPOSE_BUY_CREDITS_CTA_COMPACT },
  );
  assert.deepEqual(resultPrimaryAction({ showCreditsCta: false, stickerPackResult: true, stickerResult: true }), {
    kind: "none",
    label: "",
  });
  assert.equal(COMPOSE_SAVE_PROMPT_CTA, "Сохранить");
  assert.equal(COMPOSE_SAVING_PROMPT_CTA, "Сохраняем…");
  assert.equal(composeNeedsPhotoCtaLabel("photoshoot"), COMPOSE_SELECT_PHOTO_CTA);
  assert.equal(
    composeNeedsPhotoCtaLabel("photoshoot", { isAuthed: true }),
    COMPOSE_SELECT_PHOTO_CTA,
  );
  assert.equal(
    composeNeedsPhotoCtaLabel("photoshoot", { isAuthed: false }),
    COMPOSE_GUEST_UPLOAD_PHOTO_CTA,
  );
  assert.equal(
    composeNeedsPhotoCtaLabel("photo_prompt", { isAuthed: false }),
    COMPOSE_SELECT_PHOTO_CTA,
  );
  assert.equal(composeModeFromDockIntent("photoshoot"), "photoshoot");
  assert.equal(composeModeFromDockIntent("photo_prompt"), "photo_prompt");
  assert.equal(composeModeFromDockIntent("animate"), "video");
  assert.equal(composeModeFromDockIntent("resume"), "image");
  assert.equal(composeModeFromDockIntent("text"), "image");
});

test("«Инструмент» sheet lists tools in a fixed order and drops the ones a flag closed", () => {
  assert.deepEqual(
    [...COMPOSE_TOOL_ORDER],
    ["image", "video", "photoshoot", "sticker", "photo_prompt"],
  );
  assert.deepEqual(
    composeToolOptions({ videoEnabled: true, photoshootEnabled: true, stickerEnabled: true }),
    ["image", "video", "photoshoot", "sticker", "photo_prompt"],
  );
  assert.deepEqual(
    composeToolOptions({ videoEnabled: false, photoshootEnabled: false, stickerEnabled: false }),
    ["image", "photo_prompt"],
  );
  // /stiker-iz-foto seeds sticker before the config answers: the picked tool must stay on the row.
  assert.deepEqual(
    composeToolOptions({
      videoEnabled: false,
      photoshootEnabled: false,
      stickerEnabled: false,
      current: "sticker",
    }),
    ["image", "sticker", "photo_prompt"],
  );
  assert.equal(COMPOSE_TOOL_EDGE_LABEL, "Инструмент");
  assert.equal(COMPOSE_TOOL_SHEET_DONE_CTA, "Готово");
});

test("secondary tiles: photo → style + model, video → model, sticker → style, rest → none", () => {
  assert.deepEqual(composeSecondaryTools("image"), ["style", "model"]);
  assert.deepEqual(composeSecondaryTools("video"), ["model"]);
  assert.deepEqual(composeSecondaryTools("sticker"), ["style"]);
  assert.deepEqual(composeSecondaryTools("photoshoot"), []);
  assert.deepEqual(composeSecondaryTools("photo_prompt"), []);
  assert.equal(COMPOSE_STYLE_TOOL_EDGE_LABEL, "Стиль");
  assert.equal(COMPOSE_MODEL_TOOL_EDGE_LABEL, "Модель");
});

test("sticker tool has two kinds; pack CTA is «скоро» until enqueue is unlocked", () => {
  assert.deepEqual([...STICKER_TOOL_KINDS], ["single", "pack"]);
  assert.equal(stickerToolKindLabel("single"), "Стикер");
  assert.equal(stickerToolKindLabel("pack"), "Стикер пак");
  assert.equal(
    composeCtaDisabledForStickerPack({ composeMode: "sticker", stickerKind: "pack" }),
    true,
  );
  assert.equal(
    composeCtaDisabledForStickerPack({
      composeMode: "sticker",
      stickerKind: "pack",
      enqueueEnabled: false,
    }),
    true,
  );
  assert.equal(
    composeCtaDisabledForStickerPack({
      composeMode: "sticker",
      stickerKind: "pack",
      enqueueEnabled: true,
    }),
    false,
  );
  assert.equal(
    composeCtaDisabledForStickerPack({ composeMode: "sticker", stickerKind: "single" }),
    false,
  );
  // Pack kind is remembered but must not block other tools.
  assert.equal(
    composeCtaDisabledForStickerPack({ composeMode: "image", stickerKind: "pack" }),
    false,
  );
  assert.match(STICKER_PACK_SOON_CTA, /скоро/i);
  assert.equal(STICKER_PACK_CREATE_CTA, "Создать стикер пак");
  assert.equal(composeToolTileBodyLabel({ composeMode: "sticker", stickerKind: "pack" }), "Стикер пак");
  assert.equal(composeToolTileBodyLabel({ composeMode: "sticker", stickerKind: "single" }), "Стикер");
  assert.equal(composeToolTileBodyLabel({ composeMode: "video", stickerKind: "pack" }), "Видео");
  assert.equal(composeToolTileBodyLabel({ composeMode: "image", stickerKind: "single" }), "Фото");
});

test("photoshoot mode does not enqueue without editKind=photoshoot", () => {
  assert.equal(
    canEnqueueWhilePhotoshootSelected({ composeMode: "photoshoot" }),
    false
  );
  assert.equal(
    canEnqueueWhilePhotoshootSelected({
      composeMode: "photoshoot",
      editKind: PHOTOSHOOT_EDIT_KIND,
    }),
    true
  );
  assert.equal(
    canEnqueueWhilePhotoshootSelected({ composeMode: "image" }),
    true
  );
  assert.equal(
    canEnqueueWhilePhotoshootSelected({
      composeMode: "image",
      editKind: STICKER_EDIT_KIND,
    }),
    true
  );
  assert.equal(
    canEnqueueWhilePhotoshootSelected({ composeMode: "photo_prompt" }),
    false
  );
});

test("sticker is a select-only tool and only enqueues editKind=sticker", () => {
  assert.equal(composeModeTileLabel("sticker"), "Стикер");
  assert.equal(composeModeFromDockIntent("sticker"), "sticker");
  assert.equal(composeGenerateCtaLabel("sticker"), "Создать стикер");
  assert.equal(composeGenerateCtaShowsModelName("sticker", { isAuthed: true }), false);
  // Sticker never says «фото»: the source may be a pet, a meme or a drawing.
  assert.equal(
    composeNeedsPhotoCtaLabel("sticker", { isAuthed: false }),
    COMPOSE_STICKER_GUEST_UPLOAD_PICTURE_CTA,
  );
  assert.equal(
    composeNeedsPhotoCtaLabel("sticker", { isAuthed: true }),
    COMPOSE_STICKER_SELECT_PICTURE_CTA,
  );
  assert.equal(composeNeedsPhotoCtaLabel("sticker"), COMPOSE_STICKER_SELECT_PICTURE_CTA);
  assert.doesNotMatch(COMPOSE_STICKER_GUEST_UPLOAD_PICTURE_CTA, /фото/i);
  assert.doesNotMatch(COMPOSE_STICKER_SELECT_PICTURE_CTA, /фото/i);
  assert.equal(
    canEnqueueWhilePhotoshootSelected({ composeMode: "sticker" }),
    false,
  );
  assert.equal(
    canEnqueueWhilePhotoshootSelected({
      composeMode: "sticker",
      editKind: STICKER_EDIT_KIND,
    }),
    true,
  );
  assert.equal(
    canEnqueueWhilePhotoshootSelected({
      composeMode: "sticker",
      editKind: "sticker_pack",
    }),
    true,
  );
});

test("sticker from result accepts a plain photo and rejects video, sticker, pack, photoshoot", () => {
  assert.deepEqual(
    resolveStickerFromResultFrame({
      generationId: " gen ",
      resultUrl: " https://cdn/a.png ",
      resultModality: "image",
      resultEditKind: null,
    }),
    { parentGenerationId: "gen", previewUrl: "https://cdn/a.png" },
  );
  assert.equal(
    resolveStickerFromResultFrame({
      generationId: "gen",
      resultUrl: "https://cdn/a.png",
      resultModality: "video",
      resultEditKind: null,
    }),
    null,
  );
  for (const resultEditKind of ["sticker", "sticker_pack", "photoshoot"]) {
    assert.equal(
      resolveStickerFromResultFrame({
        generationId: "gen",
        resultUrl: "https://cdn/a.png",
        resultModality: "image",
        resultEditKind,
      }),
      null,
    );
  }
  assert.equal(
    resolveStickerFromResultFrame({
      generationId: "",
      resultUrl: "https://cdn/a.png",
      resultModality: "image",
      resultEditKind: null,
    }),
    null,
  );
});

test("sticker footer prices GPT Image 2.5 at 5 wherever the tool is picked", () => {
  assert.deepEqual(stickerStudioCta({}), { modelLabel: "GPT Image 2.5", cost: 5 });
  assert.deepEqual(stickerStudioCta({ modelId: "gpt-image-2.5-flare", cost: 5 }), {
    modelLabel: "GPT Image 2.5",
    cost: 5,
  });
});
