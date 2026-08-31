import { DEFAULT_VIDEO_PROMPT } from "./generation/image-options";
import { isGenericVideoPrompt } from "./video-animate-scenario";
import {
  extractVideoMotionSection,
  looksLikeStructuredPhotoPrompt,
} from "./video-motion-prompt";

export const VIDEO_CATALOG_MOTION_HEADING = "Motion:";

const MOTION_HEADING_RE = /^Motion:\s*/m;

export function videoCatalogSourceGenerationIds(input: {
  parentGenerationId?: string | null;
  librarySourceGenerationId?: string | null;
}): string[] {
  const ids: string[] = [];
  for (const raw of [input.parentGenerationId, input.librarySourceGenerationId]) {
    const id = String(raw || "").trim();
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function canUseGenerationAsVideoCatalogImageSource(input: {
  status?: string | null;
  modality?: string | null;
  promptText?: string | null;
}): boolean {
  if (String(input.status || "").trim() !== "completed") return false;
  if (String(input.modality || "image").trim() === "video") return false;
  return Boolean(String(input.promptText || "").trim());
}

/**
 * Catalog / Repeat prompt for a published video card: look + Motion.
 * Generic motion still gets a Motion section so Repeat can split the two jobs.
 */
export function assembleVideoCatalogPrompt(input: {
  imagePrompt?: string | null;
  motionPrompt?: string | null;
}): string {
  const image = String(input.imagePrompt || "").trim();
  const motionRaw = String(input.motionPrompt || "").trim();
  const motion =
    motionRaw && !isGenericVideoPrompt(motionRaw)
      ? motionRaw
      : DEFAULT_VIDEO_PROMPT;
  if (!image) return motionRaw || motion;
  if (extractVideoMotionSection(image)) return image;
  if (image.includes(motion)) return image;
  if (MOTION_HEADING_RE.test(image)) return `${image}\n\n${motion}`;
  return `${image}\n\n${VIDEO_CATALOG_MOTION_HEADING}\n${motion}`;
}

export function splitVideoCatalogPrompt(text: string): {
  imagePrompt: string;
  motionPrompt: string;
} {
  const raw = String(text || "").trim();
  const motion = extractVideoMotionSection(raw);
  if (motion) {
    const headingAt = raw.search(MOTION_HEADING_RE);
    const imagePrompt = headingAt >= 0 ? raw.slice(0, headingAt).trim() : raw;
    return { imagePrompt, motionPrompt: motion };
  }
  if (looksLikeStructuredPhotoPrompt(raw)) {
    return { imagePrompt: raw, motionPrompt: DEFAULT_VIDEO_PROMPT };
  }
  return { imagePrompt: "", motionPrompt: raw || DEFAULT_VIDEO_PROMPT };
}
