import type { SupabaseClient } from "@supabase/supabase-js";

export function anyPublishHidden(
  rows: Array<{ publish_hidden?: boolean | null } | null | undefined> | null | undefined,
): boolean {
  return (rows ?? []).some((row) => row?.publish_hidden === true);
}

/**
 * Publish control on a result. A hidden user keeps the catalog link for a card
 * that is already public, and loses every action that would publish again.
 */
export function showUserPublishControl(input: {
  publishHidden: boolean;
  isPublished: boolean;
  catalogSlug: string | null;
  republish: boolean;
}): boolean {
  if (!input.publishHidden) return true;
  return input.isPublished && Boolean(input.catalogSlug) && !input.republish;
}

export async function isPublishHiddenForUser(
  supabase: SupabaseClient,
  userIds: Array<string | null | undefined>,
): Promise<boolean> {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (!ids.length) return false;
  const { data, error } = await supabase
    .from("landing_users")
    .select("publish_hidden")
    .in("id", ids);
  if (error) {
    console.warn("[publish-access] lookup failed", { message: error.message });
    return false;
  }
  return anyPublishHidden(data as Array<{ publish_hidden?: boolean | null }> | null);
}
