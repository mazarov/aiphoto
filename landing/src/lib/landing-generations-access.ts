import type { SupabaseClient } from "@supabase/supabase-js";

/** Same ownership filter as GET /api/generations — requester JWT or legacy paid rows. */
export function landingGenerationsOwnerOrFilter(
  authUserId: string,
  dbUserId: string
): string {
  return `requester_auth_user_id.eq.${authUserId},and(requester_auth_user_id.is.null,credits_spent.gt.0,user_id.eq.${dbUserId})`;
}

export type GenerationStorageRef = {
  id: string;
  result_storage_bucket: string | null;
  result_storage_path: string | null;
};

function storageRefKey(bucket: string, path: string): string {
  return `${bucket}\n${path}`;
}

/**
 * Best-effort remove result objects that are not used by catalog media.
 * If the reference lookup fails, cleanup fails closed and keeps all objects.
 */
export async function removeGenerationResultObjects(
  supabase: SupabaseClient,
  rows: GenerationStorageRef[]
): Promise<void> {
  const candidates = rows.flatMap((row) => {
    const bucket = row.result_storage_bucket?.trim();
    const path = row.result_storage_path?.trim();
    return bucket && path ? [{ bucket, path }] : [];
  });
  if (candidates.length === 0) return;

  const buckets = [...new Set(candidates.map((candidate) => candidate.bucket))];
  const paths = [...new Set(candidates.map((candidate) => candidate.path))];
  const { data: referencedMedia, error: referencesError } = await supabase
    .from("prompt_card_media")
    .select("storage_bucket,storage_path")
    .in("storage_bucket", buckets)
    .in("storage_path", paths);

  if (referencesError) {
    console.error(
      "[landing-generations] storage reference lookup failed; keeping result objects:",
      referencesError.message
    );
    return;
  }

  const protectedRefs = new Set(
    (referencedMedia || []).map((media) =>
      storageRefKey(media.storage_bucket as string, media.storage_path as string)
    )
  );
  const byBucket = new Map<string, string[]>();
  for (const { bucket, path } of candidates) {
    if (protectedRefs.has(storageRefKey(bucket, path))) continue;
    const list = byBucket.get(bucket) ?? [];
    list.push(path);
    byBucket.set(bucket, list);
  }

  for (const [bucket, paths] of byBucket) {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) {
      console.error(
        `[landing-generations] storage cleanup failed bucket=${bucket}:`,
        error.message
      );
    }
  }
}
