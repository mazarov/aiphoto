import type { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { ensureLandingUserForGeneration } from "@/lib/ensure-landing-user";
import { extensionLog } from "@/lib/extension-pipeline-log";
import {
  extensionRateLimitDayWindowStartIso,
  extensionRateLimitIpHash,
  extensionRateLimitParsedIp,
} from "@/lib/extension-rate-limit-ip";
import { isStvGuestUser } from "@/lib/stv-guest-mode";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";

type SupabaseServer = ReturnType<typeof createSupabaseServer>;

export const ANALYZE_FREE_PER_DAY_DEFAULT = 10;
export const ANALYZE_CREDIT_COST_DEFAULT = 1;
const CONFIG_TTL_MS = 120_000;

export type AnalyzeQuotaMode = "free" | "paid";
export type AnalyzeQuotaNextMode = "free" | "paid" | "auth_required" | "no_credits";
export type AnalyzeQuotaDenyError = "auth_required" | "no_credits";

export type AnalyzeQuotaFields = {
  mode: AnalyzeQuotaMode | AnalyzeQuotaNextMode;
  free_max: number;
  remaining_free: number;
  credits_charged: number;
  authenticated: boolean;
  credit_cost: number;
  credits?: number;
  next_mode?: AnalyzeQuotaNextMode;
};

export type AnalyzeQuotaSnapshot = {
  authenticated: boolean;
  userId: string | null;
  bucketKey: string;
  ipHash: string;
  windowStart: string;
  freeMax: number;
  creditCost: number;
  count: number;
  pending: number;
  remainingFree: number;
  nextMode: AnalyzeQuotaNextMode;
  credits: number | null;
};

export type AnalyzeQuotaSession = AnalyzeQuotaSnapshot & {
  holdId: string | null;
  mode: AnalyzeQuotaMode | null;
  creditsCharged: number;
};

type Config = { freePerDay: number; creditCost: number };

let configCache: { value: Config; expiresAt: number } | null = null;

export function isAnalyzePaidIdentity(user: User | null): user is User {
  if (!user) return false;
  if (user.is_anonymous === true) return false;
  if (isStvGuestUser(user)) return false;
  return true;
}

function parsePositiveInt(raw: unknown, fallback: number): number {
  const value = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export async function getAnalyzeQuotaConfig(
  supabase: SupabaseServer,
): Promise<Config> {
  if (configCache && configCache.expiresAt > Date.now()) return configCache.value;
  const fallback: Config = {
    freePerDay: ANALYZE_FREE_PER_DAY_DEFAULT,
    creditCost: ANALYZE_CREDIT_COST_DEFAULT,
  };
  try {
    const { data, error } = await supabase
      .from("aiid_app_config")
      .select("key,value")
      .in("key", ["analyze_free_per_day", "analyze_credit_cost"]);
    if (error) {
      extensionLog("analyze_quota.config_error", { message: error.message });
      return configCache?.value ?? fallback;
    }
    const map = new Map(
      (data || []).map((row) => [String(row.key), row.value] as const),
    );
    const value: Config = {
      freePerDay: parsePositiveInt(map.get("analyze_free_per_day"), fallback.freePerDay),
      creditCost: parsePositiveInt(map.get("analyze_credit_cost"), fallback.creditCost),
    };
    configCache = { value, expiresAt: Date.now() + CONFIG_TTL_MS };
    return value;
  } catch (error) {
    extensionLog("analyze_quota.config_error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return configCache?.value ?? fallback;
  }
}

function remainingFree(freeMax: number, count: number, pending: number): number {
  return Math.max(0, freeMax - (count + pending));
}

/** Timestamptz compare — never string-compare ISO (`+00:00` < `.000Z`). */
export function isAnalyzeQuotaCurrentWindow(
  rowWindow: string | null | undefined,
  windowStart: string,
): boolean {
  if (!rowWindow) return false;
  const rowMs = Date.parse(rowWindow);
  const startMs = Date.parse(windowStart);
  if (!Number.isFinite(rowMs) || !Number.isFinite(startMs)) return false;
  return rowMs >= startMs;
}

function nextMode(
  remaining: number,
  authenticated: boolean,
  credits: number | null,
  creditCost: number,
): AnalyzeQuotaNextMode {
  if (remaining > 0) return "free";
  if (!authenticated) return "auth_required";
  if ((credits ?? 0) >= creditCost) return "paid";
  return "no_credits";
}

async function readUsage(
  supabase: SupabaseServer,
  bucketKey: string,
  windowStart: string,
): Promise<{ count: number; pending: number }> {
  const { data, error } = await supabase
    .from("extension_rate_limit")
    .select("count,pending,window_start")
    .eq("ip_hash", bucketKey)
    .maybeSingle();
  if (error) throw error;
  if (!data || !isAnalyzeQuotaCurrentWindow(String(data.window_start ?? ""), windowStart)) {
    return { count: 0, pending: 0 };
  }
  return {
    count: Number(data.count ?? 0) || 0,
    pending: Number(data.pending ?? 0) || 0,
  };
}

export const SCOUT_ANALYZE_BUCKET = "scout:v1";
export const SCOUT_ANALYZE_FREE_PER_DAY = 200;

export async function resolveScoutAnalyzeQuotaSnapshot(
  supabase: SupabaseServer,
): Promise<AnalyzeQuotaSnapshot> {
  const windowStart = extensionRateLimitDayWindowStartIso();
  const usage = await readUsage(supabase, SCOUT_ANALYZE_BUCKET, windowStart);
  const remaining = remainingFree(
    SCOUT_ANALYZE_FREE_PER_DAY,
    usage.count,
    usage.pending,
  );
  return {
    authenticated: false,
    userId: null,
    bucketKey: SCOUT_ANALYZE_BUCKET,
    ipHash: SCOUT_ANALYZE_BUCKET,
    windowStart,
    freeMax: SCOUT_ANALYZE_FREE_PER_DAY,
    creditCost: 1,
    count: usage.count,
    pending: usage.pending,
    remainingFree: remaining,
    nextMode: remaining > 0 ? "free" : "auth_required",
    credits: null,
  };
}

export async function resolveAnalyzeQuotaSnapshot(
  req: NextRequest,
  supabase: SupabaseServer,
): Promise<AnalyzeQuotaSnapshot> {
  const config = await getAnalyzeQuotaConfig(supabase);
  const ipHash = extensionRateLimitIpHash(extensionRateLimitParsedIp(req.headers));
  const windowStart = extensionRateLimitDayWindowStartIso();
  const { user } = await getSupabaseUserForApiRoute(req);

  let authenticated = false;
  let userId: string | null = null;
  let credits: number | null = null;

  if (isAnalyzePaidIdentity(user)) {
    const ensured = await ensureLandingUserForGeneration(supabase, user);
    if (!ensured.ok || ensured.usedGuestOwner) {
      throw new Error("analyze_identity_unavailable");
    }
    authenticated = true;
    userId = ensured.dbUserId;
    credits = ensured.credits;
    const { error: mergeError } = await supabase.rpc(
      "extension_rate_limit_merge_ip_to_user",
      {
        p_user_id: userId,
        p_ip_hash: ipHash,
        p_window_start: windowStart,
      },
    );
    if (mergeError) {
      extensionLog("analyze_quota.merge_error", { message: mergeError.message });
    }
  }

  const bucketKey = userId ? `user:${userId}` : ipHash;
  const usage = await readUsage(supabase, bucketKey, windowStart);
  const remaining = remainingFree(config.freePerDay, usage.count, usage.pending);

  if (authenticated && userId && credits == null) {
    const { data } = await supabase
      .from("landing_users")
      .select("credits")
      .eq("id", userId)
      .maybeSingle();
    credits = Number(data?.credits ?? 0) || 0;
  }

  return {
    authenticated,
    userId,
    bucketKey,
    ipHash,
    windowStart,
    freeMax: config.freePerDay,
    creditCost: config.creditCost,
    count: usage.count,
    pending: usage.pending,
    remainingFree: remaining,
    nextMode: nextMode(remaining, authenticated, credits, config.creditCost),
    credits: authenticated ? credits ?? 0 : null,
  };
}

type ReserveRpcRow = {
  allowed?: unknown;
  error?: unknown;
  mode?: unknown;
  hold_id?: unknown;
  count?: unknown;
  pending?: unknown;
  remaining_free?: unknown;
  credits_charged?: unknown;
  credits_left?: unknown;
  authenticated?: unknown;
};

export async function reserveAnalyzeQuota(
  supabase: SupabaseServer,
  snapshot: AnalyzeQuotaSnapshot,
): Promise<
  | { ok: true; session: AnalyzeQuotaSession }
  | { ok: false; error: AnalyzeQuotaDenyError; snapshot: AnalyzeQuotaSnapshot }
> {
  const { data, error } = await supabase.rpc("analyze_quota_reserve", {
    p_bucket_key: snapshot.bucketKey,
    p_window_start: snapshot.windowStart,
    p_authenticated: snapshot.authenticated,
    p_user_id: snapshot.userId,
    p_free_per_day: snapshot.freeMax,
    p_credit_cost: snapshot.creditCost,
  });
  if (error) {
    extensionLog("analyze_quota.reserve_error", { message: error.message });
    throw new Error("analyze_quota_unavailable");
  }

  const row = data as ReserveRpcRow | null;
  const count = Number(row?.count ?? snapshot.count) || 0;
  const pending = Number(row?.pending ?? snapshot.pending) || 0;
  const remaining = Number(row?.remaining_free ?? remainingFree(snapshot.freeMax, count, pending));
  const deny = String(row?.error || "");
  const nextSnapshot: AnalyzeQuotaSnapshot = {
    ...snapshot,
    count,
    pending,
    remainingFree: remaining,
    nextMode: nextMode(
      remaining,
      snapshot.authenticated,
      row?.credits_left == null ? snapshot.credits : Number(row.credits_left) || 0,
      snapshot.creditCost,
    ),
    credits:
      row?.credits_left == null
        ? snapshot.credits
        : Number(row.credits_left) || 0,
  };

  if (row?.allowed !== true) {
    if (deny === "no_credits") {
      return { ok: false, error: "no_credits", snapshot: nextSnapshot };
    }
    return { ok: false, error: "auth_required", snapshot: nextSnapshot };
  }

  const mode = row?.mode === "paid" ? "paid" : "free";
  return {
    ok: true,
    session: {
      ...nextSnapshot,
      holdId: typeof row?.hold_id === "string" ? row.hold_id : null,
      mode,
      creditsCharged: Number(row?.credits_charged ?? 0) || 0,
    },
  };
}

export async function confirmAnalyzeQuota(
  supabase: SupabaseServer,
  session: AnalyzeQuotaSession,
): Promise<AnalyzeQuotaSession> {
  if (!session.holdId) return session;
  const { data, error } = await supabase.rpc("analyze_quota_confirm", {
    p_hold_id: session.holdId,
  });
  if (error) {
    extensionLog("analyze_quota.confirm_error", { message: error.message });
    throw new Error("analyze_quota_unavailable");
  }
  const row = data as { count?: unknown; pending?: unknown } | null;
  const count = Number(row?.count ?? session.count) || 0;
  const pending = Number(row?.pending ?? session.pending) || 0;
  const remaining = remainingFree(session.freeMax, count, pending);
  return {
    ...session,
    count,
    pending,
    remainingFree: remaining,
    nextMode: nextMode(remaining, session.authenticated, session.credits, session.creditCost),
  };
}

export async function releaseAnalyzeQuota(
  supabase: SupabaseServer,
  session: AnalyzeQuotaSession,
): Promise<void> {
  if (!session.holdId) return;
  const { error } = await supabase.rpc("analyze_quota_release", {
    p_hold_id: session.holdId,
  });
  if (error) {
    extensionLog("analyze_quota.release_error", { message: error.message });
  }
}

export function analyzeQuotaPublicFields(
  snapshot: AnalyzeQuotaSnapshot,
  extras?: { mode?: AnalyzeQuotaMode; creditsCharged?: number },
): AnalyzeQuotaFields {
  const mode = extras?.mode ?? snapshot.nextMode;
  return {
    mode,
    free_max: snapshot.freeMax,
    remaining_free: snapshot.remainingFree,
    credits_charged: extras?.creditsCharged ?? 0,
    authenticated: snapshot.authenticated,
    credit_cost: snapshot.creditCost,
    ...(snapshot.credits != null ? { credits: snapshot.credits } : {}),
    next_mode: snapshot.nextMode,
  };
}

export function analyzeQuotaGetBody(snapshot: AnalyzeQuotaSnapshot): AnalyzeQuotaFields & {
  authenticated: boolean;
  next_mode: AnalyzeQuotaNextMode;
} {
  return {
    authenticated: snapshot.authenticated,
    free_max: snapshot.freeMax,
    remaining_free: snapshot.remainingFree,
    next_mode: snapshot.nextMode,
    credit_cost: snapshot.creditCost,
    credits_charged: 0,
    mode: snapshot.nextMode,
    ...(snapshot.credits != null ? { credits: snapshot.credits } : {}),
  };
}

export const ANALYZE_QUOTA_MESSAGES = {
  auth_required:
    "Бесплатные разборы на сегодня закончились. Войдите, чтобы продолжить — дальше 1 токен за анализ.",
  no_credits:
    "Бесплатные разборы на сегодня закончились. Пополните токены: анализ стоит 1 токен.",
  quota_unavailable:
    "Сервис лимитов временно недоступен. Попробуйте ещё раз.",
} as const;
