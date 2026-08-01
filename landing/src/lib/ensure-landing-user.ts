import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isStvGuestUser } from "@/lib/stv-guest-mode";
import {
  extractOauthProviderSubs,
  resolveSharedDbUserId,
} from "@/lib/resolve-db-user-id";

const GUEST_OWNER_EMAIL = "stv-guest-owner@promptshot.internal";
const GUEST_OWNER_CONFIG_KEY = "stv_guest_owner_user_id";

type EnsureResult =
  | { ok: true; credits: number; dbUserId: string; usedGuestOwner: boolean }
  | { ok: false; status: number; error: string; message: string };

async function readCachedGuestOwnerId(supabase: SupabaseClient): Promise<string | null> {
  const envId = process.env.STV_GUEST_OWNER_USER_ID?.trim();
  if (envId) return envId;

  try {
    const { data } = await supabase
      .from("photo_app_config")
      .select("value")
      .eq("key", GUEST_OWNER_CONFIG_KEY)
      .maybeSingle();
    const value = typeof data?.value === "string" ? data.value.trim() : "";
    return value || null;
  } catch {
    return null;
  }
}

async function cacheGuestOwnerId(supabase: SupabaseClient, userId: string): Promise<void> {
  try {
    await supabase.from("photo_app_config").upsert(
      {
        key: GUEST_OWNER_CONFIG_KEY,
        value: userId,
        description:
          "Stable landing_users.id used as landing_generations.user_id for STV_GUEST_MODE",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
  } catch (err) {
    console.warn("[ensureLandingUser] failed to cache guest owner id", {
      userId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Prefer an id that already satisfies landing_users → auth.users FK. */
async function resolveExistingLandingUserId(
  supabase: SupabaseClient,
  preferredId: string | null
): Promise<string | null> {
  if (preferredId) {
    const { data } = await supabase
      .from("landing_users")
      .select("id")
      .eq("id", preferredId)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  const { data: oldest } = await supabase
    .from("landing_users")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return oldest?.id ?? null;
}

/**
 * Guest DB principal.
 *
 * Observed on Dockhost: GoTrue admin.createUser / getUserById succeed, but
 * `landing_users` FK to `auth.users` still rejects those ids (identity split).
 * Therefore guest writes MUST reuse an id that already exists in `landing_users`
 * (proven FK-valid), not a freshly minted GoTrue user.
 */
/** Public: FK-valid landing_users.id for open-debug / anonymous guest DB writes. */
export async function resolveGuestOwnerDbUserId(
  supabase: SupabaseClient
): Promise<{ userId: string } | { error: string }> {
  const cached = await readCachedGuestOwnerId(supabase);
  const fromLanding = await resolveExistingLandingUserId(supabase, cached);
  if (fromLanding) {
    if (fromLanding !== cached) {
      await cacheGuestOwnerId(supabase, fromLanding);
    }
    console.log("[ensureLandingUser] guest owner from existing landing_users", {
      ownerId: fromLanding,
      fromCache: Boolean(cached && cached === fromLanding),
    });
    return { userId: fromLanding };
  }

  // Last resort: create via GoTrue, then require landing_users row (trigger or upsert).
  // On identity-split installs this path usually fails; kept for healthy single-DB setups.
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: GUEST_OWNER_EMAIL,
    email_confirm: true,
    user_metadata: { stv_guest_owner: true },
    app_metadata: { provider: "stv_guest_owner", providers: ["stv_guest_owner"] },
  });

  let ownerId = created?.user?.id || "";
  if (createError || !ownerId) {
    const msg = createError?.message || "createUser failed";
    if (!/already|registered|exists/i.test(msg)) {
      return {
        error:
          `${msg}. No landing_users rows available for guest owner fallback. ` +
          "Sign in once with Google/Yandex on the site, or set STV_GUEST_OWNER_USER_ID to an existing landing_users.id.",
      };
    }
    for (let page = 1; page <= 5; page += 1) {
      const { data: listed, error: listError } = await supabase.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (listError) return { error: listError.message };
      const found = listed.users.find(
        (u) => String(u.email || "").toLowerCase() === GUEST_OWNER_EMAIL
      );
      if (found?.id) {
        ownerId = found.id;
        break;
      }
      if (!listed.users.length || listed.users.length < 200) break;
    }
  }

  if (!ownerId) {
    return {
      error:
        "guest owner missing and landing_users is empty. Sign in once with OAuth, then retry guest generate.",
    };
  }

  // Trigger may have created the profile; otherwise try upsert (works only if auth.users is shared).
  const existing = await resolveExistingLandingUserId(supabase, ownerId);
  if (existing) {
    await cacheGuestOwnerId(supabase, existing);
    return { userId: existing };
  }

  const { error: upsertError } = await supabase.from("landing_users").upsert(
    {
      id: ownerId,
      display_name: "STV Guest Owner",
      provider: "stv_guest_owner",
      credits: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (upsertError) {
    return {
      error:
        `GoTrue/Postgres identity split: cannot attach landing_users to new auth user (${upsertError.message}). ` +
        "Workaround: open the site, sign in with Google/Yandex once (creates landing_users), set STV_GUEST_OWNER_USER_ID to that user id, retry.",
    };
  }

  await cacheGuestOwnerId(supabase, ownerId);
  console.log("[ensureLandingUser] guest owner ready via createUser", { ownerId });
  return { userId: ownerId };
}

async function ensureLandingProfileForDbUser(
  supabase: SupabaseClient,
  dbUserId: string,
  user: User
): Promise<{ credits: number } | { error: string }> {
  const { data: existing } = await supabase
    .from("landing_users")
    .select("credits")
    .eq("id", dbUserId)
    .maybeSingle();
  if (existing) {
    return { credits: Number(existing.credits || 0) };
  }

  const provider = String(
    (user.app_metadata?.provider as string | undefined) ||
      (user.app_metadata?.providers as string[] | undefined)?.[0] ||
      "oauth"
  );
  const { error } = await supabase.from("landing_users").upsert(
    {
      id: dbUserId,
      display_name: user.email ?? null,
      provider,
      credits: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) return { error: error.message };
  return { credits: 0 };
}

/**
 * Resolve the DB user id that may own landing_generations / credits.
 * For guests this is a stable FK-valid landing_users row; caller JWT remains capability.
 * For OAuth: map JWT → imageprompt_users via google_sub when ids diverge (shared DB).
 */
export async function ensureLandingUserForGeneration(
  supabase: SupabaseClient,
  user: User
): Promise<EnsureResult> {
  const guestMode = isStvGuestUser(user);

  if (guestMode) {
    const owner = await resolveGuestOwnerDbUserId(supabase);
    if ("error" in owner) {
      console.error("[ensureLandingUser] guest owner provision failed", {
        callerUserId: user.id,
        error: owner.error,
      });
      return {
        ok: false,
        status: 500,
        error: "guest_owner_unavailable",
        message:
          "Гостевой режим: нет FK-валидного профиля. Войдите один раз через Google/Yandex на сайте и повторите.",
      };
    }
    return {
      ok: true,
      credits: 0,
      dbUserId: owner.userId,
      usedGuestOwner: true,
    };
  }

  const resolved = await resolveSharedDbUserId(supabase, user);
  if (resolved) {
    if (resolved.dbUserId !== user.id) {
      console.log("[ensureLandingUser] mapped auth user to shared db user", {
        authUserId: user.id,
        dbUserId: resolved.dbUserId,
        source: resolved.source,
      });
    }
    const profile = await ensureLandingProfileForDbUser(supabase, resolved.dbUserId, user);
    if ("error" in profile) {
      console.error("[ensureLandingUser] landing_users ensure failed", {
        authUserId: user.id,
        dbUserId: resolved.dbUserId,
        ensureError: profile.error,
      });
      return {
        ok: false,
        status: 500,
        error: "server_error",
        message: "Не удалось создать профиль пользователя",
      };
    }
    return {
      ok: true,
      credits: profile.credits,
      dbUserId: resolved.dbUserId,
      usedGuestOwner: false,
    };
  }

  const { data: authLookup } = await supabase.auth.admin.getUserById(user.id);
  if (!authLookup?.user) {
    return {
      ok: false,
      status: 401,
      error: "unauthorized",
      message: "Сессия пользователя не найдена",
    };
  }

  const subs = extractOauthProviderSubs(authLookup.user);
  const googleSub = subs[0];
  if (!googleSub) {
    console.error("[ensureLandingUser] no oauth provider subject for new shared user", {
      authUserId: user.id,
    });
    return {
      ok: false,
      status: 500,
      error: "server_error",
      message: "Не удалось создать профиль пользователя",
    };
  }

  const { error: ipInsertError } = await supabase.from("imageprompt_users").insert({
    id: user.id,
    google_sub: googleSub,
    email: user.email ?? null,
    email_verified: true,
    display_name: user.email ?? null,
  });

  let dbUserId = user.id;
  if (ipInsertError) {
    // Race / pre-existing google_sub on another id — resolve again.
    const again = await resolveSharedDbUserId(supabase, authLookup.user);
    if (!again) {
      console.error("[ensureLandingUser] imageprompt_users insert failed", {
        authUserId: user.id,
        ensureError: ipInsertError.message,
      });
      return {
        ok: false,
        status: 500,
        error: "server_error",
        message: "Не удалось создать профиль пользователя",
      };
    }
    dbUserId = again.dbUserId;
  }

  const profile = await ensureLandingProfileForDbUser(supabase, dbUserId, user);
  if ("error" in profile) {
    console.error("[ensureLandingUser] landing_users upsert failed", {
      authUserId: user.id,
      dbUserId,
      ensureError: profile.error,
    });
    return {
      ok: false,
      status: 500,
      error: "server_error",
      message: "Не удалось создать профиль пользователя",
    };
  }

  return {
    ok: true,
    credits: profile.credits,
    dbUserId,
    usedGuestOwner: false,
  };
}
