import {
  composeModeFromDockIntent,
  type GenerateComposeMode,
} from "./generate-compose-mode";
import {
  isCompletedResultSeed,
  isRestorableLastDockResult,
  photoshootTileUrlsFromUnknown,
  shouldHydrateLastDockResult,
  type GenerateDockSeed,
  type LastDockResult,
} from "./generate-dock-seed";
import { isStickerGenerateDockPath } from "./generate-dock-path";
import type { GenerateComposeJobPhase } from "./generate-compose-job";
import { isGenericVideoPrompt } from "./video-animate-scenario";
import {
  extractVideoMotionSection,
  looksLikeStructuredPhotoPrompt,
} from "./video-motion-prompt";

export type SeedSyncTransitionResult = {
  composeMode: GenerateComposeMode;
  phase: GenerateComposeJobPhase;
  progress: number;
  draftPrompt: string;
  submittedPrompt: string;
  pickedExampleCardId: string | null;
  pickedExamplePreviewUrl: string | null;
  generationId: string | null;
  resultUrl: string | null;
  resultModality: "image" | "video";
  isPublished: boolean;
  resultEditKind: string | null;
  photoshootTileUrls: string[] | null;
  animateParentId: string | null;
  animatePreviewUrl: string | null;
  scenarioLoading: boolean;
};

export function resolveAnimateSeedDraftPrompt(promptText: string): string {
  const catalogMotion = extractVideoMotionSection(promptText);
  if (catalogMotion && !isGenericVideoPrompt(catalogMotion)) {
    return catalogMotion;
  }
  if (
    looksLikeStructuredPhotoPrompt(promptText) ||
    isGenericVideoPrompt(promptText)
  ) {
    return "";
  }
  return promptText.trim() ? promptText : "";
}

/**
 * Pure state transition when `seedToken` advances in-place without unmounting
 * `CardInlineGeneratePanel`. Warm caches (`models`, `videoModels`, `photos`,
 * `credits`, `stickerCatalog`, user preferences) remain intact in the panel.
 */
export function computeSeedSyncTransition(input: {
  seed: GenerateDockSeed;
  pathname?: string | null;
  isDock: boolean;
  isAuthed: boolean;
  lastDockResult: LastDockResult | null;
  lastDockResultDismissed: boolean;
}): SeedSyncTransitionResult {
  const { seed } = input;
  const pathname = input.pathname || "";

  if (isCompletedResultSeed(seed)) {
    const prompt = seed.promptText.trim();
    return {
      composeMode: "image",
      phase: "done",
      progress: 100,
      draftPrompt: prompt,
      submittedPrompt: prompt,
      pickedExampleCardId: seed.cardId || null,
      pickedExamplePreviewUrl: seed.cardId ? (seed.examplePreviewUrl ?? null) : null,
      generationId: seed.resultGenerationId ?? null,
      resultUrl: seed.previewUrl ?? null,
      resultModality: seed.resultModality === "video" ? "video" : "image",
      isPublished: Boolean(seed.isPublished),
      resultEditKind: seed.editKind || null,
      photoshootTileUrls: photoshootTileUrlsFromUnknown(seed.photoshootTileUrls),
      animateParentId: null,
      animatePreviewUrl: null,
      scenarioLoading: false,
    };
  }

  if (seed.intent === "photo_prompt" && Boolean(seed.previewUrl)) {
    return {
      composeMode: "photo_prompt",
      phase: "generating",
      progress: 8,
      draftPrompt: seed.promptText,
      submittedPrompt: "",
      pickedExampleCardId: null,
      pickedExamplePreviewUrl: null,
      generationId: null,
      resultUrl: seed.previewUrl || null,
      resultModality: "image",
      isPublished: false,
      resultEditKind: null,
      photoshootTileUrls: null,
      animateParentId: null,
      animatePreviewUrl: null,
      scenarioLoading: false,
    };
  }

  if (seed.intent === "animate") {
    return {
      composeMode: "video",
      phase: "idle",
      progress: 0,
      draftPrompt: resolveAnimateSeedDraftPrompt(seed.promptText),
      submittedPrompt: "",
      pickedExampleCardId: seed.cardId || null,
      pickedExamplePreviewUrl: seed.cardId ? (seed.examplePreviewUrl ?? null) : null,
      generationId: null,
      resultUrl: null,
      resultModality: "image",
      isPublished: false,
      resultEditKind: null,
      photoshootTileUrls: null,
      animateParentId: seed.parentGenerationId || null,
      animatePreviewUrl: seed.previewUrl || null,
      scenarioLoading: true,
    };
  }

  const restoredLastResult =
    input.isDock &&
    seed.source === "blank" &&
    input.isAuthed &&
    shouldHydrateLastDockResult(seed, {
      dismissedLastResult: input.lastDockResultDismissed,
    }) &&
    isRestorableLastDockResult(input.lastDockResult, {
      dismissedLastResult: input.lastDockResultDismissed,
    })
      ? input.lastDockResult
      : null;

  const composeMode: GenerateComposeMode = seed.attachIdentityPhoto
    ? "image"
    : isStickerGenerateDockPath(pathname) &&
        seed.source === "blank" &&
        seed.intent === "resume"
      ? "sticker"
      : composeModeFromDockIntent(seed.intent);

  if (restoredLastResult) {
    const prompt = restoredLastResult.promptText.trim();
    return {
      composeMode,
      phase: "done",
      progress: 100,
      draftPrompt: seed.promptText || restoredLastResult.promptText || "",
      submittedPrompt: prompt,
      pickedExampleCardId: seed.cardId || null,
      pickedExamplePreviewUrl: seed.cardId ? (seed.examplePreviewUrl ?? null) : null,
      generationId: restoredLastResult.generationId,
      resultUrl: restoredLastResult.resultUrl,
      resultModality: restoredLastResult.modality === "video" ? "video" : "image",
      isPublished: Boolean(restoredLastResult.isPublished),
      resultEditKind: restoredLastResult.editKind || null,
      photoshootTileUrls: photoshootTileUrlsFromUnknown(
        restoredLastResult.photoshootTileUrls,
      ),
      animateParentId: null,
      animatePreviewUrl: null,
      scenarioLoading: false,
    };
  }

  return {
    composeMode,
    phase: "idle",
    progress: 0,
    draftPrompt: seed.promptText,
    submittedPrompt: "",
    pickedExampleCardId: seed.cardId || null,
    pickedExamplePreviewUrl: seed.cardId ? (seed.examplePreviewUrl ?? null) : null,
    generationId: null,
    resultUrl: null,
    resultModality: "image",
    isPublished: false,
    resultEditKind: null,
    photoshootTileUrls: null,
    animateParentId: null,
    animatePreviewUrl: null,
    scenarioLoading: false,
  };
}
