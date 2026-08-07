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

/** Best-effort remove result objects; groups by bucket. */
export async function removeGenerationResultObjects(
  supabase: SupabaseClient,
  rows: GenerationStorageRef[]
): Promise<void> {
  const byBucket = new Map<string, string[]>();
  for (const row of rows) {
    const bucket = row.result_storage_bucket?.trim();
    const path = row.result_storage_path?.trim();
    if (!bucket || !path) continue;
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
