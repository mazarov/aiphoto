import { resolveVideoEnqueueParentGenerationId } from "./user-generation-photo-paths";
import { isGenericVideoPrompt } from "./video-animate-scenario";
import {
  extractVideoMotionSection,
  looksLikeStructuredPhotoPrompt,
} from "./video-motion-prompt";

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

export type VideoAnimateScenarioSource = {
  parentGenerationId?: string;
  photoStoragePath?: string;
  scenarioKey: string;
};

/** Parent still XOR one library photo. Empty until video compose has a frame. */
export function resolveVideoAnimateScenarioSource(input: {
  composeMode: string;
  animateParentId?: string | null;
  selectedPhotos: Array<{
    id?: string | null;
    storagePath?: string | null;
    originalFilename?: string | null;
  }>;
}): VideoAnimateScenarioSource | null {
  if (input.composeMode !== "video") return null;

  const parent = String(input.animateParentId || "").trim();
  if (parent) {
    const scenarioKey = composeVideoScenarioKey({ parentGenerationId: parent });
    return scenarioKey ? { parentGenerationId: parent, scenarioKey } : null;
  }

  if (input.selectedPhotos.length !== 1) return null;
  const photo = input.selectedPhotos[0];
  const linkedParent = resolveVideoEnqueueParentGenerationId(
    null,
    photo.originalFilename
  );
  if (linkedParent) {
    const scenarioKey = composeVideoScenarioKey({
      parentGenerationId: linkedParent,
    });
    return scenarioKey
      ? { parentGenerationId: linkedParent, scenarioKey }
      : null;
  }

  const photoId = photo.id?.trim() || "";
  const photoStoragePath = photo.storagePath?.trim() || "";
  const scenarioKey = composeVideoScenarioKey({ photoId });
  if (!photoStoragePath || !scenarioKey) return null;
  return { photoStoragePath, scenarioKey };
}

export function seededAnimateMotionPrompt(input: {
  intent?: string | null;
  promptText?: string | null;
}): string {
  if (input.intent !== "animate") return "";
  const text = String(input.promptText || "");
  const motion = extractVideoMotionSection(text);
  if (motion && !isGenericVideoPrompt(motion)) return motion;
  if (looksLikeStructuredPhotoPrompt(text) || isGenericVideoPrompt(text)) {
    return "";
  }
  return text.trim();
}

export function shouldRequestVideoAnimateScenario(input: {
  source: VideoAnimateScenarioSource | null;
  stash: ComposePromptStash;
  seededMotion?: string | null;
  seedParentGenerationId?: string | null;
}): boolean {
  if (!input.source) return false;
  const seeded = String(input.seededMotion || "").trim();
  if (seeded && !isGenericVideoPrompt(seeded)) {
    const liveParent = input.source.parentGenerationId || "";
    const seedParent = String(input.seedParentGenerationId || "").trim();
    const animatingNewStill = Boolean(liveParent) && liveParent !== seedParent;
    if (!animatingNewStill) return false;
  }
  const saved = input.stash.videoPrompt.trim();
  if (
    input.stash.lastScenarioKey === input.source.scenarioKey &&
    saved.length > 0 &&
    !isGenericVideoPrompt(saved)
  ) {
    return false;
  }
  return true;
}
