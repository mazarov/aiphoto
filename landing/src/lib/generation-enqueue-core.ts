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

/**
 * Restore composer photo selection.
 * Explicit stored `[]` stays empty (text-only). Missing prefs default to the
 * newest library photo when one exists (identity image-to-image).
 */
export function restoreSelectedPhotoIds(input: {
  availablePhotoIds: string[];
  storedPhotoIds: string[] | undefined;
}): string[] {
  const available = new Set(input.availablePhotoIds);
  if (Array.isArray(input.storedPhotoIds)) {
    return input.storedPhotoIds.filter((id) => available.has(id));
  }
  return input.availablePhotoIds[0] ? [input.availablePhotoIds[0]] : [];
}
