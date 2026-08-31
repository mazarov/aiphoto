import assert from "node:assert/strict";
import test from "node:test";
import {
  parsePendingGenerateDock,
  previewUrlForPendingDock,
  seedForAuthReturnDock,
  stripPendingGenerateDock,
} from "./generate-dock-pending";

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
      editKind: null,
      photoshootTileUrls: null,
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
      editKind: null,
      photoshootTileUrls: null,
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
      editKind: null,
      photoshootTileUrls: null,
    },
    dockSurface: null,
  });
});

test("parsePendingGenerateDock keeps photoshoot tiles on a result seed", () => {
  const tiles = [
    "https://example/1.jpg",
    "https://example/2.jpg",
    "https://example/3.jpg",
    "https://example/4.jpg",
  ];
  const raw = JSON.stringify({
    seed: {
      source: "blank",
      promptText: "photoshoot",
      cardId: null,
      intent: "result",
      resultGenerationId: "gen-1",
      previewUrl: tiles[0],
      resultModality: "image",
      editKind: "photoshoot",
      photoshootTileUrls: tiles,
    },
    dockSurface: null,
  });
  const parsed = parsePendingGenerateDock(raw);
  assert.equal(parsed?.seed.editKind, "photoshoot");
  assert.deepEqual(parsed?.seed.photoshootTileUrls, tiles);
});

test("pending dock never keeps data or blob previews", () => {
  assert.equal(previewUrlForPendingDock("data:image/jpeg;base64,xxxx"), null);
  assert.equal(previewUrlForPendingDock("blob:https://promptshot.ru/x"), null);
  assert.equal(previewUrlForPendingDock("https://cdn.example/a.jpg"), "https://cdn.example/a.jpg");
  const stripped = stripPendingGenerateDock({
    seed: {
      source: "blank",
      promptText: "",
      cardId: null,
      intent: "photo_prompt",
      previewUrl: "data:image/jpeg;base64,xxxx",
    },
    dockSurface: null,
  });
  assert.equal(stripped.seed.previewUrl, null);
  assert.equal(stripped.seed.intent, "photo_prompt");
});

test("auth-return dock seed uses overlay intent when pending is gone", () => {
  assert.deepEqual(seedForAuthReturnDock("photo_prompt", null), {
    seed: {
      source: "blank",
      promptText: "",
      cardId: null,
      intent: "photo_prompt",
    },
    dockSurface: "photos",
  });
  assert.deepEqual(seedForAuthReturnDock("photoshoot", null).dockSurface, "photos");
  assert.deepEqual(seedForAuthReturnDock("resume", null).dockSurface, null);
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
