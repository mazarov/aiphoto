import { isGenericVideoPrompt } from "./video-animate-scenario";

export type ComposeModality = "image" | "video";

export type ComposePromptStash = {
  imagePrompt: string;
  videoPrompt: string;
  lastScenarioKey: string | null;
};

export function emptyComposePromptStash(
  seed?: Partial<ComposePromptStash>
): ComposePromptStash {
  return {
    imagePrompt: seed?.imagePrompt ?? "",
    videoPrompt: seed?.videoPrompt ?? "",
    lastScenarioKey: seed?.lastScenarioKey ?? null,
  };
}

export function composeVideoScenarioKey(input: {
  parentGenerationId?: string | null;
  photoId?: string | null;
}): string | null {
  const parent = input.parentGenerationId?.trim();
  if (parent) return `parent:${parent}`;
  const photo = input.photoId?.trim();
  if (photo) return `photo:${photo}`;
  return null;
}

export function switchComposeModalityPrompt(input: {
  from: ComposeModality;
  to: ComposeModality;
  currentDraft: string;
  stash: ComposePromptStash;
  scenarioKey?: string | null;
}): {
  stash: ComposePromptStash;
  draft: string;
  shouldLoadScenario: boolean;
} {
  const { from, to, currentDraft, stash } = input;
  const scenarioKey = input.scenarioKey ?? null;

  if (from === to) {
    return {
      stash,
      draft: currentDraft,
      shouldLoadScenario: false,
    };
  }

  if (to === "video") {
    const savedVideo = stash.videoPrompt.trim();
    const canReuse =
      Boolean(scenarioKey) &&
      stash.lastScenarioKey === scenarioKey &&
      savedVideo.length > 0 &&
      !isGenericVideoPrompt(savedVideo);
    if (canReuse) {
      return {
        stash: { ...stash, imagePrompt: currentDraft },
        draft: savedVideo,
        shouldLoadScenario: false,
      };
    }
    return {
      stash: {
        imagePrompt: currentDraft,
        videoPrompt: "",
        lastScenarioKey: scenarioKey,
      },
      draft: "",
      shouldLoadScenario: true,
    };
  }

  return {
    stash: { ...stash, videoPrompt: currentDraft },
    draft: stash.imagePrompt,
    shouldLoadScenario: false,
  };
}
