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
