import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTH_POPUP_MESSAGE_TYPE,
  AUTH_POPUP_WINDOW_NAME,
  isAuthPopupCompletionMessage,
  isEmbeddedInAppWebView,
  isOAuthPopupWindow,
} from "./auth-popup";
import {
  parsePendingGenerateDock,
  stripPendingGenerateDock,
} from "./generate-dock-pending";
import { DEFAULT_GENERATE_DOCK_SEED } from "./generate-dock-seed";
import { computeSeedSyncTransition } from "./generate-panel-seed-sync";

test("computeSeedSyncTransition switches from active result to card repeat without unmounting", () => {
  const next = computeSeedSyncTransition({
    seed: {
      source: "card",
      promptText: "Студийный портрет в мягком контровом свете",
      cardId: "card-77",
      intent: "resume",
      examplePreviewUrl: "https://cdn.example/card-77.jpg",
    },
    pathname: "/",
    isDock: true,
    isAuthed: true,
    lastDockResult: {
      generationId: "gen-old",
      resultUrl: "https://cdn.example/old.jpg",
      promptText: "old prompt",
      modality: "image",
    },
    lastDockResultDismissed: false,
  });

  assert.equal(next.composeMode, "image");
  assert.equal(next.phase, "idle");
  assert.equal(next.progress, 0);
  assert.equal(next.resultUrl, null);
  assert.equal(next.generationId, null);
  assert.equal(next.pickedExampleCardId, "card-77");
  assert.equal(next.pickedExamplePreviewUrl, "https://cdn.example/card-77.jpg");
  assert.equal(next.draftPrompt, "Студийный портрет в мягком контровом свете");
});

test("computeSeedSyncTransition restores lastDockResult on blank resume when not dismissed", () => {
  const next = computeSeedSyncTransition({
    seed: DEFAULT_GENERATE_DOCK_SEED,
    pathname: "/catalog",
    isDock: true,
    isAuthed: true,
    lastDockResult: {
      generationId: "gen-last",
      resultUrl: "https://cdn.example/last.jpg",
      promptText: "Кинематографичный кадр",
      modality: "image",
      isPublished: true,
    },
    lastDockResultDismissed: false,
  });

  assert.equal(next.phase, "done");
  assert.equal(next.progress, 100);
  assert.equal(next.generationId, "gen-last");
  assert.equal(next.resultUrl, "https://cdn.example/last.jpg");
  assert.equal(next.isPublished, true);
});

test("computeSeedSyncTransition handles sticker landing and completed result seed", () => {
  const sticker = computeSeedSyncTransition({
    seed: DEFAULT_GENERATE_DOCK_SEED,
    pathname: "/stiker-iz-foto",
    isDock: true,
    isAuthed: false,
    lastDockResult: null,
    lastDockResultDismissed: false,
  });
  assert.equal(sticker.composeMode, "sticker");
  assert.equal(sticker.phase, "idle");

  const result = computeSeedSyncTransition({
    seed: {
      source: "blank",
      promptText: "Ветер в волосах",
      cardId: null,
      intent: "result",
      resultGenerationId: "gen-vid-1",
      previewUrl: "https://cdn.example/v.mp4",
      resultModality: "video",
    },
    pathname: "/generations",
    isDock: true,
    isAuthed: true,
    lastDockResult: null,
    lastDockResultDismissed: false,
  });
  assert.equal(result.phase, "done");
  assert.equal(result.resultModality, "video");
  assert.equal(result.generationId, "gen-vid-1");
});

test("inline auth popup helpers detect popup windows and embedded WebViews accurately", () => {
  assert.equal(
    isOAuthPopupWindow({ name: AUTH_POPUP_WINDOW_NAME, opener: null }),
    true,
  );
  assert.equal(isOAuthPopupWindow({ name: "", opener: null }), false);
  assert.equal(
    isOAuthPopupWindow(
      { name: "", opener: null },
      new URLSearchParams("popup=1"),
    ),
    true,
  );

  assert.equal(
    isEmbeddedInAppWebView(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Telegram/10.5",
    ),
    true,
  );
  assert.equal(
    isEmbeddedInAppWebView(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15",
    ),
    false,
  );

  assert.equal(
    isAuthPopupCompletionMessage({
      type: AUTH_POPUP_MESSAGE_TYPE,
      ok: true,
      error: null,
    }),
    true,
  );
});

test("pending generate dock accepts auth surface and normalizes it to null for post-login restore", () => {
  const raw = JSON.stringify({
    seed: {
      source: "blank",
      promptText: "Портрет на плёнку",
      cardId: "c1",
      intent: "sticker",
    },
    dockSurface: "auth",
  });
  const parsed = parsePendingGenerateDock(raw);
  assert.equal(parsed?.seed.intent, "sticker");
  assert.equal(parsed?.dockSurface, "auth");
  const stripped = stripPendingGenerateDock(parsed!);
  assert.equal(stripped.dockSurface, null);
});
