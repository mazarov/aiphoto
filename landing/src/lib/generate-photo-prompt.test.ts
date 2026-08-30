import assert from "node:assert/strict";
import test from "node:test";
import {
  PHOTO_PROMPT_EPHEMERAL_ID,
  PHOTO_PROMPT_MAX_SELECTED,
  PHOTO_PROMPT_NEEDS_PHOTO,
  PHOTO_PROMPT_PROGRESS_LABEL,
  PHOTO_PROMPT_SUCCESS_DOCK_SURFACE,
  clampPhotoPromptSelection,
  clearPendingPhotoPrompt,
  composePhotoPromptBusyLabel,
  consumePendingPhotoPrompt,
  isPhotoPromptComposeMode,
  isPhotoPromptEphemeralId,
  makeEphemeralPhotoPromptPhoto,
  nextPhotoPromptSelection,
  peekPendingPhotoPrompt,
  photoPromptSelectionCap,
  markPhotoPromptAnalyzeCompleted,
  resetPhotoPromptAnalyzeCompletion,
  resetPhotoPromptAnalyzeShare,
  resolvePhotoPromptAnalyzeSource,
  resolvePhotoPromptDataUrl,
  setPendingPhotoPrompt,
  sharePhotoPromptAnalyze,
  shouldHoldPhotoPromptResultChrome,
  shouldReuseInFlightPhotoPromptAnalyze,
  shouldStartPhotoPromptAnalyze,
} from "./generate-photo-prompt";

test("pending photo prompt is consumed once", () => {
  clearPendingPhotoPrompt();
  setPendingPhotoPrompt({
    previewUrl: "blob:preview",
    dataUrl: "data:image/jpeg;base64,abc",
  });
  assert.deepEqual(peekPendingPhotoPrompt(), {
    previewUrl: "blob:preview",
    dataUrl: "data:image/jpeg;base64,abc",
  });
  assert.deepEqual(consumePendingPhotoPrompt(), {
    previewUrl: "blob:preview",
    dataUrl: "data:image/jpeg;base64,abc",
  });
  assert.equal(consumePendingPhotoPrompt(), null);
});

test("empty payload is ignored", () => {
  clearPendingPhotoPrompt();
  setPendingPhotoPrompt({ previewUrl: "  ", dataUrl: "data:image/jpeg;base64,abc" });
  assert.equal(peekPendingPhotoPrompt(), null);
});

test("resolvePhotoPromptDataUrl peeks pending then data-url preview", () => {
  clearPendingPhotoPrompt();
  assert.equal(resolvePhotoPromptDataUrl("https://cdn/x.jpg"), "");
  assert.equal(
    resolvePhotoPromptDataUrl("data:image/jpeg;base64,abc"),
    "data:image/jpeg;base64,abc"
  );
  setPendingPhotoPrompt({
    previewUrl: "blob:preview",
    dataUrl: "data:image/jpeg;base64,pending",
  });
  assert.equal(
    resolvePhotoPromptDataUrl("data:image/jpeg;base64,abc"),
    "data:image/jpeg;base64,pending"
  );
  consumePendingPhotoPrompt();
  assert.equal(
    resolvePhotoPromptDataUrl("data:image/jpeg;base64,abc"),
    "data:image/jpeg;base64,abc"
  );
});

test("analyze source prefers in-memory landing payload over library", () => {
  clearPendingPhotoPrompt();
  assert.equal(resolvePhotoPromptAnalyzeSource({ selectedPreviewUrl: "" }), null);
  setPendingPhotoPrompt({
    previewUrl: "data:image/jpeg;base64,land",
    dataUrl: "data:image/jpeg;base64,land",
  });
  assert.deepEqual(
    resolvePhotoPromptAnalyzeSource({
      selectedPreviewUrl: "https://cdn/library.jpg",
    }),
    {
      dataUrl: "data:image/jpeg;base64,land",
      previewUrl: "data:image/jpeg;base64,land",
    }
  );
  consumePendingPhotoPrompt();
  assert.deepEqual(
    resolvePhotoPromptAnalyzeSource({
      selectedPreviewUrl: "https://cdn/library.jpg",
    }),
    { dataUrl: "", previewUrl: "https://cdn/library.jpg" }
  );
});

test("photo prompt analyze starts only with intent and data URL", () => {
  resetPhotoPromptAnalyzeCompletion();
  assert.equal(
    shouldStartPhotoPromptAnalyze({ intent: "photo_prompt", dataUrl: "data:image/jpeg;base64,x" }),
    true
  );
  assert.equal(
    shouldStartPhotoPromptAnalyze({ intent: "photo_prompt", dataUrl: "" }),
    false
  );
  assert.equal(
    shouldStartPhotoPromptAnalyze({ intent: "text", dataUrl: "data:image/jpeg;base64,x" }),
    false
  );
});

test("in-flight analyze is reused for the same data URL and aborted only for another photo", async () => {
  resetPhotoPromptAnalyzeShare();
  assert.equal(
    shouldReuseInFlightPhotoPromptAnalyze({
      inFlightDataUrl: "data:image/jpeg;base64,a",
      nextDataUrl: "data:image/jpeg;base64,a",
    }),
    true
  );
  assert.equal(
    shouldReuseInFlightPhotoPromptAnalyze({
      inFlightDataUrl: "data:image/jpeg;base64,a",
      nextDataUrl: "data:image/jpeg;base64,b",
    }),
    false
  );

  let starts = 0;
  const firstSignal = { current: null as AbortSignal | null };
  const first = sharePhotoPromptAnalyze("data:a", (signal) => {
    starts += 1;
    firstSignal.current = signal;
    return new Promise((resolve) => {
      signal.addEventListener("abort", () => resolve("aborted-a"));
    });
  });
  const reused = sharePhotoPromptAnalyze("data:a", () => {
    starts += 1;
    return Promise.resolve("should-not-run");
  });
  assert.equal(starts, 1);

  const second = sharePhotoPromptAnalyze("data:b", async () => {
    starts += 1;
    return "ok-b";
  });
  assert.equal(firstSignal.current?.aborted, true);
  assert.equal(await first, "aborted-a");
  assert.equal(await reused, "aborted-a");
  assert.equal(await second, "ok-b");
  assert.equal(starts, 2);
  resetPhotoPromptAnalyzeShare();
});

test("completed analyze does not auto-restart until a new landing payload", () => {
  resetPhotoPromptAnalyzeCompletion();
  const dataUrl = "data:image/jpeg;base64,done";
  assert.equal(shouldStartPhotoPromptAnalyze({ intent: "photo_prompt", dataUrl }), true);
  markPhotoPromptAnalyzeCompleted(dataUrl);
  assert.equal(shouldStartPhotoPromptAnalyze({ intent: "photo_prompt", dataUrl }), false);
  setPendingPhotoPrompt({ previewUrl: dataUrl, dataUrl });
  assert.equal(shouldStartPhotoPromptAnalyze({ intent: "photo_prompt", dataUrl }), true);
  resetPhotoPromptAnalyzeCompletion();
});

test("busy label and compose-mode helper", () => {
  assert.equal(PHOTO_PROMPT_PROGRESS_LABEL, "Создание промта");
  assert.equal(PHOTO_PROMPT_SUCCESS_DOCK_SURFACE, "prompt");
  assert.equal(PHOTO_PROMPT_NEEDS_PHOTO, "Для промта выберите одно фото");
  assert.equal(composePhotoPromptBusyLabel(42.6), "Создание промта · 43%");
  assert.equal(isPhotoPromptComposeMode("photo_prompt"), true);
  assert.equal(isPhotoPromptComposeMode("image"), false);
  assert.equal(
    shouldHoldPhotoPromptResultChrome({
      composeMode: "photo_prompt",
      resultUrl: "data:image/jpeg;base64,x",
    }),
    true,
  );
  assert.equal(
    shouldHoldPhotoPromptResultChrome({ composeMode: "photo_prompt", resultUrl: "" }),
    false,
  );
  assert.equal(
    shouldHoldPhotoPromptResultChrome({
      composeMode: "image",
      resultUrl: "data:image/jpeg;base64,x",
    }),
    false,
  );
});

test("photo prompt selection is radio, cap 1", () => {
  assert.equal(PHOTO_PROMPT_MAX_SELECTED, 1);
  assert.deepEqual(
    nextPhotoPromptSelection({ current: [], toggledId: "a" }),
    ["a"]
  );
  assert.deepEqual(
    nextPhotoPromptSelection({ current: ["a"], toggledId: "b" }),
    ["b"]
  );
  assert.deepEqual(
    nextPhotoPromptSelection({ current: ["b"], toggledId: "b" }),
    []
  );
  assert.deepEqual(clampPhotoPromptSelection(["a", "b", "c"]), ["c"]);
  assert.equal(photoPromptSelectionCap("photo_prompt", 10), 1);
  assert.equal(photoPromptSelectionCap("image", 10), 10);
  assert.equal(isPhotoPromptEphemeralId(PHOTO_PROMPT_EPHEMERAL_ID), true);
  assert.equal(makeEphemeralPhotoPromptPhoto("data:image/jpeg;base64,x").id, PHOTO_PROMPT_EPHEMERAL_ID);
});
