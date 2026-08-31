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

/** Last-completed dock hydrate is resume-only — never text / photo_prompt / result. */
export function shouldHydrateLastDockResult(
  seed: GenerateDockSeed,
  options?: { dismissedLastResult?: boolean }
): boolean {
  if (options?.dismissedLastResult) return false;
  if (
    seed.intent === "animate" ||
    seed.intent === "result" ||
    seed.intent === "photoshoot"
  ) {
    return false;
  }
  return seed.source === "blank" && seed.intent === "resume";
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
