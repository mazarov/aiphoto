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
export function shouldHydrateLastDockResult(seed: GenerateDockSeed): boolean {
  return seed.source === "blank" && seed.intent === "resume";
}

/** Image-to-prompt auto-fill — photo_prompt intent with no usable prompt yet. */
export function shouldAutoAnalyzePhoto(input: {
  intent: GenerateDockComposeIntent;
  prompt: string;
}): boolean {
  return input.intent === "photo_prompt" && input.prompt.trim().length < 8;
}
