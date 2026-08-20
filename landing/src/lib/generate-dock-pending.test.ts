import assert from "node:assert/strict";
import test from "node:test";
import { parsePendingGenerateDock } from "./generate-dock-pending";

test("parsePendingGenerateDock accepts a photo_prompt seed", () => {
  const raw = JSON.stringify({
    seed: {
      source: "blank",
      promptText: "neon alley at night",
      cardId: null,
      intent: "photo_prompt",
    },
    dockSurface: "prompt",
  });
  assert.deepEqual(parsePendingGenerateDock(raw), {
    seed: {
      source: "blank",
      promptText: "neon alley at night",
      cardId: null,
      intent: "photo_prompt",
      parentGenerationId: null,
      previewUrl: null,
      resultGenerationId: null,
      resultModality: null,
      isPublished: false,
    },
    dockSurface: "prompt",
  });
});

test("parsePendingGenerateDock accepts an animate seed", () => {
  const raw = JSON.stringify({
    seed: {
      source: "blank",
      promptText: "Оживи изображение",
      cardId: null,
      intent: "animate",
      parentGenerationId: "gen-1",
      previewUrl: "https://example/a.jpg",
    },
    dockSurface: null,
  });
  assert.deepEqual(parsePendingGenerateDock(raw), {
    seed: {
      source: "blank",
      promptText: "Оживи изображение",
      cardId: null,
      intent: "animate",
      parentGenerationId: "gen-1",
      previewUrl: "https://example/a.jpg",
      resultGenerationId: null,
      resultModality: null,
      isPublished: false,
    },
    dockSurface: null,
  });
});

test("parsePendingGenerateDock accepts a completed result seed", () => {
  const raw = JSON.stringify({
    seed: {
      source: "blank",
      promptText: "Ветер в волосах",
      cardId: null,
      intent: "result",
      resultGenerationId: "gen-video-1",
      previewUrl: "https://example/a.mp4",
      resultModality: "video",
      isPublished: false,
    },
    dockSurface: null,
  });
  assert.deepEqual(parsePendingGenerateDock(raw), {
    seed: {
      source: "blank",
      promptText: "Ветер в волосах",
      cardId: null,
      intent: "result",
      parentGenerationId: null,
      previewUrl: "https://example/a.mp4",
      resultGenerationId: "gen-video-1",
      resultModality: "video",
      isPublished: false,
    },
    dockSurface: null,
  });
});

test("parsePendingGenerateDock rejects malformed payloads", () => {
  assert.equal(parsePendingGenerateDock(null), null);
  assert.equal(parsePendingGenerateDock(""), null);
  assert.equal(parsePendingGenerateDock("{"), null);
  assert.equal(
    parsePendingGenerateDock(
      JSON.stringify({
        seed: { source: "blank", promptText: "x", cardId: null, intent: "nope" },
        dockSurface: "prompt",
      }),
    ),
    null,
  );
});
