/**
 * Pure library-photo path / id helpers shared by landing and the generation worker.
 * Keep package imports out of this module — Docker compiles it without landing node_modules.
 */

export function isSafeStoragePath(path: string): boolean {
  if (!path || path.length > 512) return false;
  return !path.includes("..") && !path.includes("\\") && !path.startsWith("/");
}

export function isStoragePathOwnedByAuthUser(path: string, authUserId: string): boolean {
  return isSafeStoragePath(path) && path.startsWith(`${authUserId}/`);
}

const LIBRARY_GENERATION_FILENAME_RE =
  /^generation-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.jpe?g$/i;

/** Library copies from «Использовать» are named `generation-<uuid>.jpg`. */
export function parseLibrarySourceGenerationId(
  originalFilename: string | null | undefined,
  sourceGenerationId?: string | null,
): string | null {
  const fromColumn = String(sourceGenerationId || "").trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(fromColumn)) {
    return fromColumn.toLowerCase();
  }
  const match = String(originalFilename || "").trim().match(LIBRARY_GENERATION_FILENAME_RE);
  return match?.[1]?.toLowerCase() || null;
}

/** Prefer an explicit parent; otherwise recover it from a saved generation copy. */
export function resolveVideoEnqueueParentGenerationId(
  parentGenerationId: string | null | undefined,
  libraryOriginalFilename?: string | null,
  librarySourceGenerationId?: string | null,
): string {
  const parent = String(parentGenerationId || "").trim();
  if (parent) return parent;
  return parseLibrarySourceGenerationId(libraryOriginalFilename, librarySourceGenerationId) || "";
}
