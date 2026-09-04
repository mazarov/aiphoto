import assert from "node:assert/strict";
import test from "node:test";
import {
  PENDING_COMPOSE_EXAMPLE_KEY,
  PENDING_GENERATE_DOCK_KEY,
  consumePendingGenerateDock,
  parsePendingComposeExample,
  parsePendingGenerateDock,
  persistPendingGenerateDock,
  previewUrlForPendingDock,
  resetPendingGenerateDockForTests,
  seedForAuthReturnDock,
  shouldRestorePendingGenerateDock,
  stripPendingGenerateDock,
  takePendingComposeExample,
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

test("parsePendingGenerateDock accepts a card video-repeat seed", () => {
  const raw = JSON.stringify({
    seed: {
      source: "card",
      promptText: "Ветер шевелит волосы",
      cardId: "card-1",
      intent: "animate",
    },
    dockSurface: "photos",
  });
  assert.deepEqual(parsePendingGenerateDock(raw), {
    seed: {
      source: "card",
      promptText: "Ветер шевелит волосы",
      cardId: "card-1",
      intent: "animate",
      parentGenerationId: null,
      previewUrl: null,
      resultGenerationId: null,
      resultModality: null,
      isPublished: false,
      editKind: null,
      photoshootTileUrls: null,
    },
    dockSurface: "photos",
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

test("parsePendingGenerateDock keeps attachIdentityPhoto without data preview", () => {
  const parsed = parsePendingGenerateDock(
    JSON.stringify({
      seed: {
        source: "blank",
        promptText: "",
        cardId: "card-1",
        intent: "text",
        attachIdentityPhoto: true,
        previewUrl: "data:image/jpeg;base64,xxxx",
      },
      dockSurface: "example",
    }),
  );
  assert.equal(parsed?.seed.attachIdentityPhoto, true);
  assert.equal(parsed?.seed.cardId, "card-1");
  assert.equal(parsed?.seed.previewUrl, "data:image/jpeg;base64,xxxx");
  const stripped = stripPendingGenerateDock(parsed!);
  assert.equal(stripped.seed.attachIdentityPhoto, true);
  assert.equal(stripped.seed.previewUrl, null);
});

test("pending dock keeps catalog example pick and https thumb", () => {
  const parsed = parsePendingGenerateDock(
    JSON.stringify({
      seed: {
        source: "blank",
        promptText: "осенний портрет",
        cardId: "card-osen",
        intent: "text",
        examplePreviewUrl: "https://cdn.example/osen.jpg",
        attachIdentityPhoto: true,
      },
      dockSurface: null,
    }),
  );
  assert.equal(parsed?.seed.cardId, "card-osen");
  assert.equal(parsed?.seed.promptText, "осенний портрет");
  assert.equal(parsed?.seed.examplePreviewUrl, "https://cdn.example/osen.jpg");
  const stripped = stripPendingGenerateDock({
    seed: {
      source: "blank",
      promptText: "осенний портрет",
      cardId: "card-osen",
      intent: "text",
      examplePreviewUrl: "data:image/jpeg;base64,xxxx",
    },
    dockSurface: null,
  });
  assert.equal(stripped.seed.cardId, "card-osen");
  assert.equal(stripped.seed.examplePreviewUrl, null);
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

test("auth-return merges compose example sidecar onto an empty pending seed", () => {
  const next = seedForAuthReturnDock("text", null, {
    cardId: "card-osen",
    promptText: "осенний портрет",
    examplePreviewUrl: "https://cdn.example/osen.jpg",
  });
  assert.equal(next.seed.intent, "text");
  assert.equal(next.seed.cardId, "card-osen");
  assert.equal(next.seed.promptText, "осенний портрет");
  assert.equal(next.seed.examplePreviewUrl, "https://cdn.example/osen.jpg");
});

test("shouldRestorePendingGenerateDock skips OAuth callback", () => {
  assert.equal(shouldRestorePendingGenerateDock("/auth/callback"), false);
  assert.equal(shouldRestorePendingGenerateDock("/auth/callback/"), false);
  assert.equal(shouldRestorePendingGenerateDock("/auth/callback?code=abc"), false);
  assert.equal(shouldRestorePendingGenerateDock("/auth"), false);
  assert.equal(shouldRestorePendingGenerateDock("/generaciya-foto"), true);
  assert.equal(shouldRestorePendingGenerateDock("/generate"), true);
  assert.equal(shouldRestorePendingGenerateDock("/"), true);
});

test("parsePendingComposeExample keeps https thumb and rejects empty cardId", () => {
  assert.deepEqual(
    parsePendingComposeExample(
      JSON.stringify({
        cardId: "card-osen",
        promptText: "осенний портрет",
        examplePreviewUrl: "https://cdn.example/osen.jpg",
      }),
    ),
    {
      cardId: "card-osen",
      promptText: "осенний портрет",
      examplePreviewUrl: "https://cdn.example/osen.jpg",
    },
  );
  assert.equal(parsePendingComposeExample(JSON.stringify({ cardId: "" })), null);
  assert.equal(
    parsePendingComposeExample(
      JSON.stringify({
        cardId: "card-osen",
        promptText: "x",
        examplePreviewUrl: "data:image/jpeg;base64,xx",
      }),
    )?.examplePreviewUrl,
    null,
  );
});

function withSessionStorage<T>(run: (store: Map<string, string>) => T): T {
  const store = new Map<string, string>();
  const sessionStorage = {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
  };
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: { sessionStorage },
  });
  resetPendingGenerateDockForTests();
  try {
    return run(store);
  } finally {
    resetPendingGenerateDockForTests();
    if (previous) {
      Object.defineProperty(globalThis, "window", previous);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }
}

test("selfie persist without cardId does not wipe the compose example sidecar", () => {
  withSessionStorage((store) => {
    persistPendingGenerateDock({
      seed: {
        source: "blank",
        promptText: "осенний портрет",
        cardId: "card-osen",
        intent: "text",
        examplePreviewUrl: "https://cdn.example/osen.jpg",
      },
      dockSurface: null,
    });
    persistPendingGenerateDock({
      seed: {
        source: "blank",
        promptText: "",
        cardId: null,
        intent: "text",
        attachIdentityPhoto: true,
      },
      dockSurface: "example",
    });
    const sidecar = parsePendingComposeExample(
      store.get(PENDING_COMPOSE_EXAMPLE_KEY) ?? null,
    );
    assert.equal(sidecar?.cardId, "card-osen");
    assert.equal(sidecar?.promptText, "осенний портрет");
    const pending = parsePendingGenerateDock(
      store.get(PENDING_GENERATE_DOCK_KEY) ?? null,
    );
    assert.equal(pending?.seed.cardId, null);
    const restored = seedForAuthReturnDock("text", pending, sidecar);
    assert.equal(restored.seed.cardId, "card-osen");
    assert.equal(restored.seed.promptText, "осенний портрет");
  });
});

test("consume pending dock is sticky across a second take on the same page", () => {
  withSessionStorage((store) => {
    persistPendingGenerateDock({
      seed: {
        source: "blank",
        promptText: "осенний портрет",
        cardId: "card-osen",
        intent: "text",
      },
      dockSurface: null,
    });
    const first = consumePendingGenerateDock();
    assert.equal(first?.seed.cardId, "card-osen");
    assert.equal(store.has(PENDING_GENERATE_DOCK_KEY), false);
    const second = consumePendingGenerateDock();
    assert.equal(second?.seed.cardId, "card-osen");
    const example = takePendingComposeExample();
    assert.equal(example?.cardId, "card-osen");
    assert.equal(takePendingComposeExample()?.cardId, "card-osen");
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
