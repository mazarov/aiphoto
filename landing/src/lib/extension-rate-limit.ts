import type { NextRequest } from "next/server";
import {
  extensionRateLimitDayWindowStartIso,
  extensionRateLimitIpHash,
  extensionRateLimitParsedIp,
} from "@/lib/extension-rate-limit-ip";
export { extensionRateLimitEffectiveUsage } from "@/lib/extension-rate-limit-ip";
import { extensionLog } from "@/lib/extension-pipeline-log";
import {
  extractOauthProviderSubs,
  resolveSharedDbUserId,
} from "@/lib/resolve-db-user-id";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import type { User } from "@supabase/supabase-js";

const DEFAULT_MAX = 30;
const CONFIG_TTL_MS = 120_000;
type SupabaseServer = ReturnType<typeof createSupabaseServer>;

let configCache: { value: number; expiresAt: number } | null = null;

export type ExtensionRateLimitCheckResult = {
  allowed: boolean;
  count: number;
  pending: number;
  max: number;
  authenticated: boolean;
  bucket: "ip" | "user";
  ipHash: string;
  windowStart: string;
  userId: string | null;
};

type Context = Omit<
  ExtensionRateLimitCheckResult,
  "allowed" | "count" | "pending"
> & { bucketKey: string };

export type ExtensionRateLimitSession = {
  ctx: Context;
  check: ExtensionRateLimitCheckResult;
};

async function getLimit(supabase: SupabaseServer): Promise<number> {
  if (configCache && configCache.expiresAt > Date.now()) return configCache.value;
  try {
    const { data, error } = await supabase
      .from("aiid_app_config")
      .select("value")
      .eq("key", "extension_rate_limit_per_day")
      .maybeSingle();
    if (!error) {
      const value = Number.parseInt(String(data?.value ?? ""), 10);
      if (Number.isFinite(value) && value > 0) {
        configCache = { value, expiresAt: Date.now() + CONFIG_TTL_MS };
        return value;
      }
    }
  } catch (error) {
    extensionLog("rate_limit.config_error", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
  return configCache?.value ?? DEFAULT_MAX;
}

async function resolveAnalyzeUserId(
  supabase: SupabaseServer,
  user: User,
): Promise<string | null> {
  const shared = await resolveSharedDbUserId(supabase, user);
  if (shared) {
    const { data } = await supabase
      .from("imageprompt_users")
      .select("id")
      .eq("id", shared.dbUserId)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  const { data: fullUserData } = await supabase.auth.admin.getUserById(user.id);
  const fullUser = fullUserData?.user ?? user;
  for (const sub of extractOauthProviderSubs(fullUser)) {
    const { data } = await supabase
      .from("imageprompt_users")
      .select("id")
      .eq("google_sub", sub)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  const email = (fullUser.email || user.email || "").trim().toLowerCase();
  if (!email) return null;
  const { data } = await supabase
    .from("imageprompt_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  return data?.id ?? null;
}

async function resolveContext(
  req: NextRequest,
  supabase: SupabaseServer,
): Promise<Context> {
  const ipHash = extensionRateLimitIpHash(
    extensionRateLimitParsedIp(req.headers),
  );
  const windowStart = extensionRateLimitDayWindowStartIso();
  const max = await getLimit(supabase);
  const { user } = await getSupabaseUserForApiRoute(req);
  const userId = user ? await resolveAnalyzeUserId(supabase, user) : null;
  const authenticated = Boolean(userId);
  const bucketKey = userId ? `user:${userId}` : ipHash;

  if (userId) {
    const { error } = await supabase.rpc(
      "extension_rate_limit_merge_ip_to_user",
      {
        p_user_id: userId,
        p_ip_hash: ipHash,
        p_window_start: windowStart,
      },
    );
    if (error) {
      extensionLog("rate_limit.merge_error", { message: error.message });
    }
  }

  return {
    ipHash,
    windowStart,
    max,
    authenticated,
    userId,
    bucket: authenticated ? "user" : "ip",
    bucketKey,
  };
}

function result(
  ctx: Context,
  row: { allowed?: unknown; count?: unknown; pending?: unknown } | null,
): ExtensionRateLimitCheckResult {
  return {
    allowed: row?.allowed === true,
    count: Number(row?.count ?? 0) || 0,
    pending: Number(row?.pending ?? 0) || 0,
    max: ctx.max,
    authenticated: ctx.authenticated,
    bucket: ctx.bucket,
    ipHash: ctx.ipHash,
    windowStart: ctx.windowStart,
    userId: ctx.userId,
  };
}

export async function beginExtensionRateLimitSession(
  req: NextRequest,
  supabase: SupabaseServer,
): Promise<ExtensionRateLimitSession | null> {
  try {
    const ctx = await resolveContext(req, supabase);
    const { data } = await supabase
      .from("extension_rate_limit")
      .select("count,pending")
      .eq("ip_hash", ctx.bucketKey)
      .eq("window_start", ctx.windowStart)
      .maybeSingle();
    const count = Number(data?.count ?? 0) || 0;
    const pending = Number(data?.pending ?? 0) || 0;
    return {
      ctx,
      check: {
        ...ctx,
        allowed: count + pending < ctx.max,
        count,
        pending,
      },
    };
  } catch (error) {
    extensionLog("rate_limit.fail_open", {
      phase: "preflight",
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function callRateLimitRpc(
  supabase: SupabaseServer,
  session: ExtensionRateLimitSession,
  fn:
    | "extension_rate_limit_reserve_if_allowed"
    | "extension_rate_limit_confirm_reservation"
    | "extension_rate_limit_release_reservation",
): Promise<ExtensionRateLimitCheckResult | null> {
  try {
    const args: Record<string, unknown> = {
      p_ip_hash: session.ctx.bucketKey,
      p_window_start: session.ctx.windowStart,
    };
    if (fn === "extension_rate_limit_reserve_if_allowed") {
      args.p_max_count = session.ctx.max;
    }
    const { data, error } = await supabase.rpc(fn, args);
    if (error) {
      extensionLog("rate_limit.fail_open", {
        phase: fn,
        message: error.message,
      });
      return null;
    }
    return result(
      session.ctx,
      data as { allowed?: unknown; count?: unknown; pending?: unknown } | null,
    );
  } catch (error) {
    extensionLog("rate_limit.fail_open", {
      phase: fn,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export function reserveExtensionRateLimitForSession(
  supabase: SupabaseServer,
  session: ExtensionRateLimitSession,
) {
  return callRateLimitRpc(
    supabase,
    session,
    "extension_rate_limit_reserve_if_allowed",
  );
}

export function confirmExtensionRateLimitForSession(
  supabase: SupabaseServer,
  session: ExtensionRateLimitSession,
) {
  return callRateLimitRpc(
    supabase,
    session,
    "extension_rate_limit_confirm_reservation",
  );
}

export function releaseExtensionRateLimitForSession(
  supabase: SupabaseServer,
  session: ExtensionRateLimitSession,
) {
  return callRateLimitRpc(
    supabase,
    session,
    "extension_rate_limit_release_reservation",
  );
}
