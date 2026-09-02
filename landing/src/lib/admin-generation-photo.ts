import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { publicObjectUploadOptions } from "@/lib/storage-cache-control";

export const ADMIN_GENERATION_UPLOAD_BUCKET = "web-generation-uploads";
const CONFIG_KEY = "admin_generation_photo_path";
const PREFIX = "admin/pinned-reference/";
const SIGNED_URL_TTL = 3600;

function isAllowedPath(path: string): boolean {
  return path.startsWith(PREFIX) && !path.includes("..");
}

export async function getAdminPinnedPhotoPath(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.from("photo_app_config").select("value").eq("key", CONFIG_KEY).maybeSingle();
  if (error) throw new Error(`pinned_photo_config_read_failed:${error.message}`);
  const path = String(data?.value || "");
  return isAllowedPath(path) ? path : null;
}

export async function getAdminPinnedPhotoSignedUrl(supabase: SupabaseClient, path: string) {
  if (!isAllowedPath(path)) throw new Error("invalid_pinned_photo_path");
  const { data, error } = await supabase.storage.from(ADMIN_GENERATION_UPLOAD_BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data?.signedUrl) throw new Error(`pinned_photo_signed_url_failed:${error?.message || "unknown"}`);
  return { storagePath: path, signedUrl: data.signedUrl };
}

export async function validateAndUploadAdminPhoto(supabase: SupabaseClient, file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("invalid_file_type");
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > 10 * 1024 * 1024) throw new Error("file_too_large");
  const image = await sharp(Buffer.from(bytes)).resize(2048, 2048, {
    fit: "inside", withoutEnlargement: true,
  }).jpeg({ quality: 85 }).toBuffer();
  const path = `${PREFIX}${Date.now()}-${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await supabase.storage.from(ADMIN_GENERATION_UPLOAD_BUCKET).upload(
    path,
    image,
    publicObjectUploadOptions({ contentType: "image/jpeg", upsert: false }),
  );
  if (uploadError) throw new Error(`pinned_photo_upload_failed:${uploadError.message}`);
  const { error: configError } = await supabase.from("photo_app_config").upsert({
    key: CONFIG_KEY, value: path, updated_at: new Date().toISOString(),
  }, { onConflict: "key" });
  if (configError) {
    await supabase.storage.from(ADMIN_GENERATION_UPLOAD_BUCKET).remove([path]);
    throw new Error(`pinned_photo_config_write_failed:${configError.message}`);
  }
  return path;
}
