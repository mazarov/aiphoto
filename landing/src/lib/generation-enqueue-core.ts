export type GenerationSourceType =
  | "text_only"
  | "user_photos"
  | "generation_result";

export type GenerationSurface = "prompt_card" | "seo_page";

/** Funnel label only — never a capability gate for photos. */
export function normalizeGenerationSurface(value: unknown): GenerationSurface {
  return value === "seo_page" ? "seo_page" : "prompt_card";
}

export function resolveGenerationSourceType(input: {
  hasParentGeneration: boolean;
  photoCount: number;
}): GenerationSourceType {
  if (input.hasParentGeneration) return "generation_result";
  return input.photoCount > 0 ? "user_photos" : "text_only";
}

/** Drop empty / non-string paths so an ephemeral selfie cannot count as a library photo. */
export function normalizePhotoStoragePaths(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const paths: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const path = item.trim();
    if (path) paths.push(path);
  }
  return paths;
}

/**
 * Restore composer photo selection.
 * Explicit stored `[]` stays empty (text-only). Missing prefs, or a stored
 * list whose photos all left the library, default to the newest library photo.
 */
export function restoreSelectedPhotoIds(input: {
  availablePhotoIds: string[];
  storedPhotoIds: string[] | undefined;
}): string[] {
  const newest = input.availablePhotoIds[0] ? [input.availablePhotoIds[0]] : [];
  if (!Array.isArray(input.storedPhotoIds)) return newest;
  const available = new Set(input.availablePhotoIds);
  const kept = input.storedPhotoIds.filter((id) => available.has(id));
  if (input.storedPhotoIds.length > 0 && kept.length === 0) return newest;
  return kept;
}
