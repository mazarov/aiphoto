import type { SupabaseClient } from "@supabase/supabase-js";

export {
  isSafeStoragePath,
  isStoragePathOwnedByAuthUser,
  parseLibrarySourceGenerationId,
  resolveVideoEnqueueParentGenerationId,
} from "./user-generation-photo-paths";

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
