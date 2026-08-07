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

/** Parent results must remain available while a queued child still consumes them. */
export async function findGenerationIdsWithActiveChildren(
  supabase: SupabaseClient,
  generationIds: string[]
): Promise<Set<string>> {
  if (generationIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("landing_generations")
    .select("parent_generation_id")
    .in("parent_generation_id", generationIds)
    .in("status", ["pending", "processing"]);
  if (error) throw error;
  return new Set(
    (data || [])
      .map((row) => row.parent_generation_id as string | null)
      .filter((id): id is string => Boolean(id))
  );
}

/** Terminal children no longer consume the parent image and may release the FK. */
export async function detachTerminalGenerationChildren(
  supabase: SupabaseClient,
  generationIds: string[]
): Promise<void> {
  if (generationIds.length === 0) return;
  const { error } = await supabase
    .from("landing_generations")
    .update({ parent_generation_id: null })
    .in("parent_generation_id", generationIds)
    .in("status", ["completed", "failed"]);
  if (error) throw error;
}

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
