export type GenerateDockComposeIntent = "resume" | "text" | "photo_prompt";

export type GenerateDockSeed = {
  source: "blank" | "card";
  promptText: string;
  cardId: string | null;
  intent: GenerateDockComposeIntent;
};

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

/** Last-completed dock hydrate is resume-only — never text / photo_prompt. */
export function shouldHydrateLastDockResult(
  seed: GenerateDockSeed,
  options?: { dismissedLastResult?: boolean }
): boolean {
  if (options?.dismissedLastResult) return false;
  return seed.source === "blank" && seed.intent === "resume";
}

/**
 * User-photo library is a generation reference, not an analyze source.
 * `photo_prompt` compose is text-only after ephemeral analyze on the starter.
 */
export function shouldAttachLibraryPhotos(seed: GenerateDockSeed): boolean {
  return seed.intent !== "photo_prompt";
}
