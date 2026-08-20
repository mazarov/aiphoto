import type { SupabaseClient } from "@supabase/supabase-js";

export const USER_GENERATION_PHOTOS_BUCKET = "web-generation-uploads";
export const USER_GENERATION_PHOTO_SIGNED_TTL_SEC = 60 * 60 * 24;

export type UserGenerationPhotoRow = {
  id: string;
  auth_user_id: string;
  storage_path: string;
  original_filename: string | null;
  byte_size: number | null;
  width: number | null;
  height: number | null;
  created_at: string;
};

export type UserGenerationPhoto = {
  id: string;
  storagePath: string;
  previewUrl: string | null;
  originalFilename: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
};

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

export async function toUserGenerationPhotos(
  supabase: SupabaseClient,
  rows: UserGenerationPhotoRow[]
): Promise<UserGenerationPhoto[]> {
  if (!rows.length) return [];

  const { data: signedRows, error } = await supabase.storage
    .from(USER_GENERATION_PHOTOS_BUCKET)
    .createSignedUrls(
      rows.map((row) => row.storage_path),
      USER_GENERATION_PHOTO_SIGNED_TTL_SEC
    );

  if (error) {
    console.error("[user-generation-photos] signed URLs failed", error.message);
  }

  return rows.map((row, index) => ({
    id: row.id,
    storagePath: row.storage_path,
    previewUrl: signedRows?.[index]?.signedUrl ?? null,
    originalFilename: row.original_filename,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
  }));
}
