import assert from "node:assert/strict";
import test from "node:test";
import { PHOTOSHOOT_EDIT_KIND } from "./photoshoot";
import {
  apiModalityForComposeMode,
  canEnqueueWhilePhotoshootSelected,
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
  composeNeedsPhotoCtaLabel,
  COMPOSE_GUEST_UPLOAD_PHOTO_CTA,
  COMPOSE_SELECT_PHOTO_CTA,
  composeModeTileSheet,
  nextComposeModeTileSheet,
  promptModalityForComposeMode,
  rememberCompletedImageResult,
  resolvePhotoshootLibraryFrame,
  resolvePhotoshootReadyFrame,
} from "./generate-compose-mode";

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

test("image and video tiles toggle the model sheet; photoshoot is select-only", () => {
  assert.equal(composeModeTileSheet("image"), "model");
  assert.equal(composeModeTileSheet("video"), "model");
  assert.equal(composeModeTileSheet("photoshoot"), null);
  assert.equal(composeModeTileSheet("photo_prompt"), "photos");
  assert.equal(
    nextComposeModeTileSheet({
      mode: "photoshoot",
      alreadyInMode: false,
      currentSheet: null,
    }),
    null,
  );
  assert.equal(
    nextComposeModeTileSheet({
      mode: "photo_prompt",
      alreadyInMode: false,
      currentSheet: null,
    }),
    "photos",
  );
  assert.equal(
    nextComposeModeTileSheet({
      mode: "photo_prompt",
      alreadyInMode: true,
      currentSheet: "photos",
    }),
    null,
  );
  assert.equal(
    nextComposeModeTileSheet({
      mode: "video",
      alreadyInMode: false,
      currentSheet: "photos",
    }),
    "model",
  );
  assert.equal(
    nextComposeModeTileSheet({
      mode: "image",
      alreadyInMode: false,
      currentSheet: null,
    }),
    "model",
  );
  assert.equal(
    nextComposeModeTileSheet({
      mode: "image",
      alreadyInMode: true,
      currentSheet: "model",
    }),
    null,
  );
  assert.equal(
    nextComposeModeTileSheet({
      mode: "video",
      alreadyInMode: true,
      currentSheet: "model",
    }),
    null,
  );
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
    canEnqueueWhilePhotoshootSelected({ composeMode: "photo_prompt" }),
    false
  );
});
