import { isGenericVideoPrompt } from "./video-animate-scenario";

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
 * Catalog / Repeat prompt for a published video card.
 * Image look comes from the parent still; motion is the I2V beat.
 */
export function assembleVideoCatalogPrompt(input: {
  imagePrompt?: string | null;
  motionPrompt?: string | null;
}): string {
  const image = String(input.imagePrompt || "").trim();
  const motion = String(input.motionPrompt || "").trim();
  if (!image) return motion;
  if (!motion || isGenericVideoPrompt(motion)) return image;
  if (image.includes(motion)) return image;
  if (MOTION_HEADING_RE.test(image)) return `${image}\n\n${motion}`;
  return `${image}\n\n${VIDEO_CATALOG_MOTION_HEADING}\n${motion}`;
}
