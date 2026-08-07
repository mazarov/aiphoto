import type { SupabaseClient, User } from "@supabase/supabase-js";

type IdentityLike = {
  provider?: string;
  id?: string;
  provider_id?: string;
  identity_data?: Record<string, unknown> | null;
};

export type ResolvedDbUserId = {
  /** FK-valid id in imageprompt_users / landing_users */
  dbUserId: string;
  authUserId: string;
  source: "jwt" | "google_sub" | "email";
};

function pushUnique(target: string[], value: unknown): void {
  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (!trimmed || target.includes(trimmed)) return;
  target.push(trimmed);
}

/** Collect OAuth subject ids that may match imageprompt_users.google_sub. */
export function extractOauthProviderSubs(user: User): string[] {
  const identities = (user.identities ?? []) as IdentityLike[];
  const subs: string[] = [];
  for (const identity of identities) {
    const data = identity.identity_data ?? {};
    pushUnique(subs, identity.provider_id);
    pushUnique(subs, data.sub);
    pushUnique(subs, data.provider_id);
    // Older GoTrue shapes sometimes put the provider subject in identity.id
    // (not a UUID). Prefer real subs above; keep this as last resort.
    if (identity.id && !identity.id.includes("-")) {
      pushUnique(subs, identity.id);
    }
  }
  return subs;
}

async function loadUserWithIdentities(
  supabase: SupabaseClient,
  user: User
): Promise<User> {
  if (user.identities && user.identities.length > 0) return user;
  const { data, error } = await supabase.auth.admin.getUserById(user.id);
  if (error || !data?.user) return user;
  return data.user;
}

/**
 * Shared-DB identity: JWT auth.users.id may differ from imageprompt_users.id
 * for the same Google account. landing_users / landing_generations FK → imageprompt_users.
 */
export async function resolveSharedDbUserId(
  supabase: SupabaseClient,
  user: User
): Promise<ResolvedDbUserId | null> {
  const authUserId = user.id;

  const { data: landingByJwt } = await supabase
    .from("landing_users")
    .select("id")
    .eq("id", authUserId)
    .maybeSingle();
  if (landingByJwt?.id) {
    return { dbUserId: landingByJwt.id, authUserId, source: "jwt" };
  }

  const { data: ipByJwt } = await supabase
    .from("imageprompt_users")
    .select("id")
    .eq("id", authUserId)
    .maybeSingle();
  if (ipByJwt?.id) {
    return { dbUserId: ipByJwt.id, authUserId, source: "jwt" };
  }

  const fullUser = await loadUserWithIdentities(supabase, user);
  const subs = extractOauthProviderSubs(fullUser);
  for (const sub of subs) {
    const { data } = await supabase
      .from("imageprompt_users")
      .select("id")
      .eq("google_sub", sub)
      .maybeSingle();
    if (data?.id) {
      return { dbUserId: data.id, authUserId, source: "google_sub" };
    }
  }

  const email = (fullUser.email || user.email || "").trim().toLowerCase();
  if (email) {
    const { data } = await supabase
      .from("imageprompt_users")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (data?.id) {
      return { dbUserId: data.id, authUserId, source: "email" };
    }
  }

  return null;
}

/** Resolve an auth.users id to the shared profile/billing namespace when they differ. */
export async function resolveSharedDbUserIdFromAuthId(
  supabase: SupabaseClient,
  authUserId: string,
): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.getUserById(authUserId);
  if (error || !data?.user) return null;
  return (await resolveSharedDbUserId(supabase, data.user))?.dbUserId ?? null;
}
