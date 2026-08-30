import assert from "node:assert/strict";
import test from "node:test";
import { PHOTOSHOOT_EDIT_KIND } from "./photoshoot";
import {
  apiModalityForComposeMode,
  canEnqueueWhilePhotoshootSelected,
  COMPOSE_BUY_CREDITS_CTA,
  COMPOSE_BUY_CREDITS_CTA_COMPACT,
  composeGenerateCtaLabel,
  composeGenerateCtaShowsModelName,
  composeModeTileLabel,
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
  assert.equal(composeModeTileLabel("photoshoot"), "Фотосессия");
  assert.equal(composeGenerateCtaLabel("image"), "Создать фото");
  assert.equal(composeGenerateCtaLabel("video"), "Создать видео");
  assert.equal(composeGenerateCtaLabel("photoshoot"), "Создать фотосессию");
  assert.equal(composeGenerateCtaShowsModelName("image"), true);
  assert.equal(composeGenerateCtaShowsModelName("video"), true);
  assert.equal(composeGenerateCtaShowsModelName("photoshoot"), false);
  assert.equal(COMPOSE_BUY_CREDITS_CTA, "Купить кредиты для создания фото");
  assert.equal(COMPOSE_BUY_CREDITS_CTA_COMPACT, "Купить кредиты");
});

test("image and video tiles toggle the model sheet; photoshoot is select-only", () => {
  assert.equal(composeModeTileSheet("image"), "model");
  assert.equal(composeModeTileSheet("video"), "model");
  assert.equal(composeModeTileSheet("photoshoot"), null);
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
});
