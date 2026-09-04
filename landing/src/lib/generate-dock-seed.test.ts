import assert from "node:assert/strict";
import test from "node:test";
import {
  applyComposeExampleToSeed,
  applySeoSelfieToSeed,
  catalogCardRepeatSeed,
  composeExamplePreviewUrlForSeed,
  mergeComposeExampleIntoSeed,
  DEFAULT_GENERATE_DOCK_SEED,
  defaultDockSurfaceForComposeEntry,
  isCompletedResultSeed,
  isRestorableLastDockResult,
  isResumeComposeSeed,
  isUploadFirstDockEntry,
  photoshootTileUrlsFromUnknown,
  resolveDockSurfaceForComposeEntry,
  sameGenerateDockComposeIdentity,
  shouldAttachLibraryPhotos,
  shouldHydrateLastDockResult,
  type GenerateDockSeed,
  type LastDockResult,
} from "./generate-dock-seed";

function seed(
  overrides: Partial<GenerateDockSeed> = {}
): GenerateDockSeed {
  return { ...DEFAULT_GENERATE_DOCK_SEED, ...overrides };
}

test("isResumeComposeSeed is true only for default blank resume", () => {
  assert.equal(isResumeComposeSeed(DEFAULT_GENERATE_DOCK_SEED), true);
  assert.equal(isResumeComposeSeed(seed({ promptText: "   " })), true);
});

test("upload-first entries open the photos sheet for photoshoot and photo_prompt", () => {
  assert.equal(isUploadFirstDockEntry("tab"), true);
  assert.equal(isUploadFirstDockEntry("fab"), true);
  assert.equal(isUploadFirstDockEntry("howto"), true);
  assert.equal(isUploadFirstDockEntry("hero"), true);
  assert.equal(isUploadFirstDockEntry("route"), false);
  assert.equal(defaultDockSurfaceForComposeEntry("photoshoot", "tab"), "photos");
  assert.equal(defaultDockSurfaceForComposeEntry("photo_prompt", "fab"), "photos");
  assert.equal(defaultDockSurfaceForComposeEntry("photoshoot", "route"), null);
  assert.equal(defaultDockSurfaceForComposeEntry("resume", "tab"), null);
  assert.equal(
    resolveDockSurfaceForComposeEntry({
      intent: "photoshoot",
      entrySource: "tab",
      explicit: null,
    }),
    null,
  );
});

test("same compose identity ignores dockSurface-only reopen", () => {
  const current = seed({ intent: "photoshoot" });
  assert.equal(sameGenerateDockComposeIdentity(current, seed({ intent: "photoshoot" })), true);
  assert.equal(sameGenerateDockComposeIdentity(current, seed({ intent: "photo_prompt" })), false);
  assert.equal(
    sameGenerateDockComposeIdentity(
      seed({ intent: "text" }),
      seed({ intent: "text", attachIdentityPhoto: true }),
    ),
    false,
  );
});

test("isResumeComposeSeed is false for photo_prompt with empty prompt", () => {
  assert.equal(
    isResumeComposeSeed(seed({ intent: "photo_prompt" })),
    false
  );
  assert.equal(isResumeComposeSeed(seed({ intent: "photoshoot" })), false);
});

test("isResumeComposeSeed is false for text intent, card, or filled prompt", () => {
  assert.equal(isResumeComposeSeed(seed({ intent: "text" })), false);
  assert.equal(
    isResumeComposeSeed(seed({ promptText: "a ready prompt" })),
    false
  );
  assert.equal(
    isResumeComposeSeed(
      seed({ source: "card", cardId: "c1", promptText: "scene" })
    ),
    false
  );
});

test("tab/fab keep last result visible instead of opening the photos sheet", () => {
  assert.equal(
    resolveDockSurfaceForComposeEntry({
      intent: "photoshoot",
      entrySource: "tab",
      hasRestorableLastResult: true,
    }),
    null
  );
  assert.equal(
    resolveDockSurfaceForComposeEntry({
      intent: "photoshoot",
      entrySource: "fab",
      hasRestorableLastResult: true,
    }),
    null
  );
  assert.equal(
    resolveDockSurfaceForComposeEntry({
      intent: "photoshoot",
      entrySource: "howto",
      hasRestorableLastResult: true,
    }),
    "photos"
  );
  assert.equal(
    resolveDockSurfaceForComposeEntry({
      intent: "photoshoot",
      entrySource: "tab",
      explicit: "photos",
      hasRestorableLastResult: true,
    }),
    "photos"
  );
});

test("shouldHydrateLastDockResult restores blank resume and photoshoot", () => {
  assert.equal(shouldHydrateLastDockResult(DEFAULT_GENERATE_DOCK_SEED), true);
  assert.equal(shouldHydrateLastDockResult(seed({ intent: "photoshoot" })), true);
  assert.equal(shouldHydrateLastDockResult(seed({ intent: "text" })), false);
  assert.equal(
    shouldHydrateLastDockResult(seed({ intent: "photo_prompt" })),
    false
  );
  assert.equal(
    shouldHydrateLastDockResult(
      seed({ source: "card", cardId: "c1", intent: "resume" })
    ),
    false
  );
});

test("isRestorableLastDockResult needs id, url, and no dismiss", () => {
  const last: LastDockResult = {
    generationId: "g1",
    resultUrl: "https://cdn/last.jpg",
    promptText: "scene",
    modality: "image",
  };
  assert.equal(isRestorableLastDockResult(last), true);
  assert.equal(
    isRestorableLastDockResult(last, { dismissedLastResult: true }),
    false
  );
  assert.equal(isRestorableLastDockResult(null), false);
});

test("shouldHydrateLastDockResult is false after explicit last-result dismiss", () => {
  assert.equal(
    shouldHydrateLastDockResult(DEFAULT_GENERATE_DOCK_SEED, {
      dismissedLastResult: true,
    }),
    false
  );
  assert.equal(
    shouldHydrateLastDockResult(DEFAULT_GENERATE_DOCK_SEED, {
      dismissedLastResult: false,
    }),
    true
  );
});

test("shouldAttachLibraryPhotos is false only for photo_prompt compose", () => {
  assert.equal(shouldAttachLibraryPhotos(DEFAULT_GENERATE_DOCK_SEED), true);
  assert.equal(shouldAttachLibraryPhotos(seed({ intent: "text" })), true);
  assert.equal(
    shouldAttachLibraryPhotos(seed({ intent: "photo_prompt" })),
    false
  );
  assert.equal(
    shouldAttachLibraryPhotos(
      seed({ intent: "photo_prompt", promptText: "a ready prompt from analyze" })
    ),
    false
  );
});

test("photoshootTileUrlsFromUnknown keeps only four urls", () => {
  const tiles = ["a", "b", "c", "d"];
  assert.deepEqual(photoshootTileUrlsFromUnknown(tiles), tiles);
  assert.equal(photoshootTileUrlsFromUnknown(["a", "b"]), null);
  assert.equal(photoshootTileUrlsFromUnknown(null), null);
});

test("completed result seed skips last-result hydrate", () => {
  const result = seed({
    intent: "result",
    promptText: "Ветер в волосах",
    resultGenerationId: "gen-video-1",
    previewUrl: "https://example/a.mp4",
    resultModality: "video",
  });
  assert.equal(isResumeComposeSeed(result), false);
  assert.equal(isCompletedResultSeed(result), true);
  assert.equal(shouldHydrateLastDockResult(result), false);
  assert.equal(shouldAttachLibraryPhotos(result), true);
});

test("animate seed skips last-result hydrate and parent library photos", () => {
  const animate = seed({
    intent: "animate",
    promptText: "Оживи изображение",
    parentGenerationId: "parent-1",
    previewUrl: "https://example/preview.jpg",
  });
  assert.equal(isResumeComposeSeed(animate), false);
  assert.equal(shouldHydrateLastDockResult(animate), false);
  assert.equal(shouldAttachLibraryPhotos(animate), false);
  assert.equal(
    shouldAttachLibraryPhotos(seed({ intent: "animate", parentGenerationId: null })),
    true
  );
});

test("compose example preview rejects data and blob URLs", () => {
  assert.equal(composeExamplePreviewUrlForSeed("https://cdn.example/a.jpg"), "https://cdn.example/a.jpg");
  assert.equal(composeExamplePreviewUrlForSeed("data:image/jpeg;base64,xx"), null);
  assert.equal(composeExamplePreviewUrlForSeed("blob:https://promptshot.ru/x"), null);
});

test("applyComposeExampleToSeed keeps selfie identity and writes catalog pick", () => {
  const next = applyComposeExampleToSeed(
    seed({
      intent: "text",
      attachIdentityPhoto: true,
      previewUrl: "data:image/jpeg;base64,selfie",
    }),
    {
      cardId: "card-osen",
      promptText: "осенний портрет",
      examplePreviewUrl: "https://cdn.example/osen.jpg",
    },
  );
  assert.equal(next.cardId, "card-osen");
  assert.equal(next.promptText, "осенний портрет");
  assert.equal(next.examplePreviewUrl, "https://cdn.example/osen.jpg");
  assert.equal(next.attachIdentityPhoto, true);
  assert.equal(next.previewUrl, "data:image/jpeg;base64,selfie");
});

test("SEO selfie seed keeps a catalog example the guest already picked", () => {
  const next = applySeoSelfieToSeed(
    seed({
      intent: "text",
      cardId: "card-osen",
      promptText: "осенний портрет",
      examplePreviewUrl: "https://cdn.example/osen.jpg",
    }),
    { previewUrl: "data:image/jpeg;base64,selfie" },
  );
  assert.equal(next.cardId, "card-osen");
  assert.equal(next.promptText, "осенний портрет");
  assert.equal(next.examplePreviewUrl, "https://cdn.example/osen.jpg");
  assert.equal(next.attachIdentityPhoto, true);
  assert.equal(next.previewUrl, "data:image/jpeg;base64,selfie");
});

test("catalogCardRepeatSeed puts the listing card into the example tile", () => {
  const next = catalogCardRepeatSeed({
    promptText: "осенний портрет",
    cardId: "card-osen",
    examplePreviewUrl: "https://cdn.example/osen.jpg",
  });
  assert.equal(next.source, "card");
  assert.equal(next.intent, "resume");
  assert.equal(next.cardId, "card-osen");
  assert.equal(next.promptText, "осенний портрет");
  assert.equal(next.examplePreviewUrl, "https://cdn.example/osen.jpg");
});

test("catalogCardRepeatSeed drops data-url previews and keeps video intent", () => {
  const next = catalogCardRepeatSeed({
    promptText: "ветер в волосах",
    cardId: "card-video",
    intent: "animate",
    examplePreviewUrl: "data:image/jpeg;base64,xx",
  });
  assert.equal(next.intent, "animate");
  assert.equal(next.cardId, "card-video");
  assert.equal(next.examplePreviewUrl, null);
});

test("mergeComposeExampleIntoSeed fills an empty auth-return seed", () => {
  const next = mergeComposeExampleIntoSeed(seed({ intent: "text" }), {
    cardId: "card-osen",
    promptText: "осенний портрет",
    examplePreviewUrl: "https://cdn.example/osen.jpg",
  });
  assert.equal(next.cardId, "card-osen");
  assert.equal(next.promptText, "осенний портрет");
  assert.equal(
    mergeComposeExampleIntoSeed(seed({ cardId: "keep" }), null).cardId,
    "keep",
  );
});
