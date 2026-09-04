import { parsePhotoshootTilePaths } from "./photoshoot";

export type GenerateDockComposeIntent =
  | "resume"
  | "text"
  | "photo_prompt"
  | "photoshoot"
  | "animate"
  | "result";

export type GenerateDockSeed = {
  source: "blank" | "card";
  promptText: string;
  cardId: string | null;
  intent: GenerateDockComposeIntent;
  /** SEO selfie flow: attach uploaded identity photo in image compose (not photo_prompt analyze). */
  attachIdentityPhoto?: boolean;
  /** Catalog example tile preview (https). Not the identity selfie. */
  examplePreviewUrl?: string | null;
  parentGenerationId?: string | null;
  previewUrl?: string | null;
  resultGenerationId?: string | null;
  resultModality?: "image" | "video" | null;
  isPublished?: boolean;
  editKind?: string | null;
  photoshootTileUrls?: string[] | null;
};

export function photoshootTileUrlsFromUnknown(raw: unknown): string[] | null {
  return parsePhotoshootTilePaths(raw);
}

/** Catalog example thumbs may be persisted; identity data:/blob: must not. */
export function composeExamplePreviewUrlForSeed(
  url?: string | null,
): string | null {
  const value = (url || "").trim();
  if (!value) return null;
  if (value.startsWith("data:") || value.startsWith("blob:")) return null;
  return value;
}

/** Guest/auth-return SSOT: catalog pick lives on the dock seed, not panel locals. */
export function applyComposeExampleToSeed(
  seed: GenerateDockSeed,
  pick: {
    cardId: string;
    promptText: string;
    examplePreviewUrl?: string | null;
  },
): GenerateDockSeed {
  const cardId = pick.cardId.trim();
  return {
    ...seed,
    cardId: cardId || null,
    promptText: pick.promptText.trim(),
    examplePreviewUrl: composeExamplePreviewUrlForSeed(pick.examplePreviewUrl),
  };
}

/** Starter selfie must not wipe a catalog example the guest already picked. */
export function applySeoSelfieToSeed(
  seed: GenerateDockSeed,
  input: { previewUrl: string },
): GenerateDockSeed {
  const previewUrl = input.previewUrl.trim();
  return {
    ...seed,
    source: "blank",
    intent: "text",
    previewUrl,
    attachIdentityPhoto: true,
  };
}

/** Catalog «Повторить»: same seed from card overlay and listing hover. */
export function catalogCardRepeatSeed(input: {
  promptText: string;
  cardId: string;
  intent?: GenerateDockComposeIntent;
  examplePreviewUrl?: string | null;
}): GenerateDockSeed {
  const intent = input.intent === "animate" ? "animate" : "resume";
  return applyComposeExampleToSeed(
    {
      source: "card",
      promptText: "",
      cardId: null,
      intent,
    },
    {
      cardId: input.cardId,
      promptText: input.promptText,
      examplePreviewUrl: input.examplePreviewUrl,
    },
  );
}

/** Auth-return: catalog pick sidecar wins over an empty restored seed. */
export function mergeComposeExampleIntoSeed(
  seed: GenerateDockSeed,
  example:
    | {
        cardId: string;
        promptText: string;
        examplePreviewUrl?: string | null;
      }
    | null
    | undefined,
): GenerateDockSeed {
  const cardId = example?.cardId?.trim() || "";
  if (!cardId) return seed;
  return applyComposeExampleToSeed(seed, {
    cardId,
    promptText: example?.promptText ?? "",
    examplePreviewUrl: example?.examplePreviewUrl,
  });
}

export const DEFAULT_GENERATE_DOCK_SEED: GenerateDockSeed = {
  source: "blank",
  promptText: "",
  cardId: null,
  intent: "resume",
};

/** FAB / tab may skip remount only for a resume blank compose. */
export function isResumeComposeSeed(seed: GenerateDockSeed): boolean {
  return (
    seed.source === "blank" &&
    !seed.promptText.trim() &&
    !seed.cardId &&
    seed.intent === "resume"
  );
}

/** External CTAs that should open «Ваши фото» for photoshoot / photo_prompt. */
export function isUploadFirstDockEntry(entrySource?: string | null): boolean {
  return (
    entrySource === "tab" ||
    entrySource === "fab" ||
    entrySource === "howto" ||
    entrySource === "hero"
  );
}

/** Same compose identity — only dockSurface may change without remounting the panel. */
export function sameGenerateDockComposeIdentity(
  current: GenerateDockSeed,
  next: GenerateDockSeed,
): boolean {
  return (
    current.intent === next.intent &&
    current.source === next.source &&
    current.promptText === next.promptText &&
    current.cardId === next.cardId &&
    Boolean(current.attachIdentityPhoto) === Boolean(next.attachIdentityPhoto) &&
    (current.parentGenerationId ?? null) === (next.parentGenerationId ?? null) &&
    (current.resultGenerationId ?? null) === (next.resultGenerationId ?? null)
  );
}

export function defaultDockSurfaceForComposeEntry(
  intent: GenerateDockComposeIntent,
  entrySource?: string | null,
): "photos" | null {
  if (!isUploadFirstDockEntry(entrySource)) return null;
  if (intent === "photoshoot" || intent === "photo_prompt") return "photos";
  return null;
}

export type LastDockResult = {
  generationId: string;
  resultUrl: string;
  promptText: string;
  modality: "image" | "video";
  isPublished?: boolean;
  editKind?: string | null;
  photoshootTileUrls?: string[] | null;
};

export function isRestorableLastDockResult(
  result: LastDockResult | null | undefined,
  options?: { dismissedLastResult?: boolean }
): boolean {
  if (options?.dismissedLastResult) return false;
  return Boolean(result?.generationId.trim() && result.resultUrl.trim());
}

export function resolveDockSurfaceForComposeEntry(input: {
  intent: GenerateDockComposeIntent;
  entrySource?: string | null;
  explicit?: "prompt" | "photos" | "model" | "example" | null;
  hasRestorableLastResult?: boolean;
}): "prompt" | "photos" | "model" | "example" | null {
  if (input.explicit !== undefined) return input.explicit;
  /**
   * Tab / FAB reopen the dock — last completed frame stays on the plate.
   * HowTo / hero stay upload-first even when a previous result exists.
   */
  if (
    input.hasRestorableLastResult &&
    (input.entrySource === "tab" || input.entrySource === "fab")
  ) {
    return null;
  }
  return defaultDockSurfaceForComposeEntry(input.intent, input.entrySource);
}

/**
 * Last completed frame is a dock-session fact, not an intent.
 * Resume + photoshoot blank compose restore it; photo_prompt / text / animate / result
 * own a different first paint (analyze, seeded prompt, overlay, history card).
 */
export function shouldHydrateLastDockResult(
  seed: GenerateDockSeed,
  options?: { dismissedLastResult?: boolean }
): boolean {
  if (options?.dismissedLastResult) return false;
  if (seed.source !== "blank") return false;
  if (seed.intent === "resume" || seed.intent === "photoshoot") return true;
  return false;
}

export function isCompletedResultSeed(seed: GenerateDockSeed): boolean {
  return (
    seed.intent === "result" &&
    Boolean(seed.resultGenerationId?.trim()) &&
    Boolean(seed.previewUrl?.trim())
  );
}

/**
 * User-photo library is a generation reference, not an analyze source.
 * `photo_prompt` uses an ephemeral in-memory payload (`generate-photo-prompt.ts`).
 */
export function shouldAttachLibraryPhotos(seed: GenerateDockSeed): boolean {
  if (seed.intent === "photo_prompt") return false;
  if (seed.intent === "animate" && seed.parentGenerationId) return false;
  return true;
}
