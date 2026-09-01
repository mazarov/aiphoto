import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  UNPAID_BANNER_TTL_MS,
  isLiveUnpaidPaymentStatus,
  pickLatestUnpaidLedgerRow,
  type UnpaidLedgerRow,
} from "@/lib/unpaid-checkout-banner";

export type PaymentProvider = "yookassa" | "robokassa";

export const PAYMENT_ROBOKASSA_FEATURE_KEY = "payment_robokassa";
export const ROBOKASSA_CANARY_EMAILS_CONFIG_KEY = "robokassa_canary_emails";

export type PaymentProviderStore = Pick<SupabaseClient, "from">;

export function getPaymentProvider(): PaymentProvider {
  const value = process.env.PAYMENT_PROVIDER?.trim().toLowerCase() || "yookassa";
  if (value !== "yookassa" && value !== "robokassa") {
    throw new Error(`Unsupported PAYMENT_PROVIDER: ${value}`);
  }
  return value;
}

export function parseEmailList(raw: string | null | undefined): string[] {
  return (raw || "")
    .split(/[,;\n]/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function parseRolloutBps(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(10000, Math.max(0, Math.trunc(parsed)));
}

export function hashAuthUserBucket(authUserId: string, featureKey: string): number {
  const digest = createHash("sha256")
    .update(`${featureKey}:${authUserId}`)
    .digest("hex");
  return Number.parseInt(digest.slice(0, 8), 16) % 10000;
}

export function decidePaymentProvider(input: {
  email?: string | null;
  unpaidProvider?: PaymentProvider | null;
  canaryEmails: ReadonlySet<string>;
  envProvider: PaymentProvider;
  rolloutEnabled: boolean;
  rolloutBps: number;
  assignmentBucket: number | null;
}): PaymentProvider {
  if (input.unpaidProvider) return input.unpaidProvider;
  const email = input.email?.trim().toLowerCase();
  if (email && input.canaryEmails.has(email)) return "robokassa";
  if (input.envProvider === "robokassa") return "robokassa";
  if (!input.rolloutEnabled || input.rolloutBps <= 0) return "yookassa";
  if (input.assignmentBucket == null) return "yookassa";
  return input.assignmentBucket < input.rolloutBps ? "robokassa" : "yookassa";
}

function mergeCanaryEmails(dbValue: string | null | undefined): Set<string> {
  return new Set([
    ...parseEmailList(dbValue),
    ...parseEmailList(process.env.ROBOKASSA_CANARY_EMAILS),
  ]);
}

function asUnpaidLedgerRow(
  provider: PaymentProvider,
  row: {
    id?: unknown;
    plan_id?: unknown;
    credits?: unknown;
    created_at?: unknown;
    credited_at?: unknown;
    status?: unknown;
  } | null,
): UnpaidLedgerRow | null {
  if (!row || typeof row.id !== "string" || typeof row.plan_id !== "string") {
    return null;
  }
  return {
    provider,
    paymentId: row.id,
    planId: row.plan_id,
    credits: Number(row.credits),
    createdAt: String(row.created_at || ""),
    creditedAt: typeof row.credited_at === "string" ? row.credited_at : null,
    status: typeof row.status === "string" ? row.status : null,
  };
}

async function readLatestLedgerRow(
  supabase: PaymentProviderStore,
  table: "landing_yookassa_payments" | "landing_robokassa_payments",
  authUserId: string,
): Promise<{
  id?: unknown;
  plan_id?: unknown;
  credits?: unknown;
  created_at?: unknown;
  credited_at?: unknown;
  status?: unknown;
} | null> {
  const { data, error } = await supabase
    .from(table)
    .select("id, plan_id, credits, created_at, credited_at, status")
    .eq("auth_user_id", authUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`${table} lookup failed: ${error.message}`);
  return data;
}

export async function loadPinnedUnpaidProvider(
  supabase: PaymentProviderStore,
  authUserId: string,
  nowMs = Date.now(),
): Promise<PaymentProvider | null> {
  const [yookassa, robokassa] = await Promise.all([
    readLatestLedgerRow(supabase, "landing_yookassa_payments", authUserId),
    readLatestLedgerRow(supabase, "landing_robokassa_payments", authUserId),
  ]);
  const picked = pickLatestUnpaidLedgerRow(
    [
      asUnpaidLedgerRow("yookassa", yookassa),
      asUnpaidLedgerRow("robokassa", robokassa),
    ],
    nowMs,
    UNPAID_BANNER_TTL_MS,
  );
  if (!picked) return null;
  if (picked.status && !isLiveUnpaidPaymentStatus(picked.status)) return null;
  return picked.provider;
}

async function loadRolloutAndCanary(supabase: PaymentProviderStore): Promise<{
  enabled: boolean;
  rolloutBps: number;
  canaryEmails: Set<string>;
}> {
  const [rolloutResult, canaryResult] = await Promise.all([
    supabase
      .from("landing_feature_rollouts")
      .select("enabled, rollout_bps")
      .eq("feature_key", PAYMENT_ROBOKASSA_FEATURE_KEY)
      .maybeSingle(),
    supabase
      .from("landing_generation_config")
      .select("value")
      .eq("key", ROBOKASSA_CANARY_EMAILS_CONFIG_KEY)
      .maybeSingle(),
  ]);
  if (rolloutResult.error) {
    throw new Error(`rollout lookup failed: ${rolloutResult.error.message}`);
  }
  if (canaryResult.error) {
    throw new Error(`canary lookup failed: ${canaryResult.error.message}`);
  }
  const rollout = rolloutResult.data as {
    enabled?: unknown;
    rollout_bps?: unknown;
  } | null;
  const canary = canaryResult.data as { value?: unknown } | null;
  return {
    enabled: rollout?.enabled === true,
    rolloutBps: parseRolloutBps(rollout?.rollout_bps),
    canaryEmails: mergeCanaryEmails(
      typeof canary?.value === "string" ? canary.value : "",
    ),
  };
}

async function getOrAssignBucket(
  supabase: PaymentProviderStore,
  authUserId: string,
): Promise<number> {
  const existing = await supabase
    .from("landing_user_feature_assignments")
    .select("bucket")
    .eq("auth_user_id", authUserId)
    .eq("feature_key", PAYMENT_ROBOKASSA_FEATURE_KEY)
    .maybeSingle();
  if (existing.error) {
    throw new Error(`assignment lookup failed: ${existing.error.message}`);
  }
  const current = Number((existing.data as { bucket?: unknown } | null)?.bucket);
  if (Number.isInteger(current) && current >= 0 && current <= 9999) {
    return current;
  }

  const bucket = hashAuthUserBucket(authUserId, PAYMENT_ROBOKASSA_FEATURE_KEY);
  const inserted = await supabase.from("landing_user_feature_assignments").insert({
    auth_user_id: authUserId,
    feature_key: PAYMENT_ROBOKASSA_FEATURE_KEY,
    bucket,
    source: "auth",
  });
  if (inserted.error && inserted.error.code !== "23505") {
    throw new Error(`assignment insert failed: ${inserted.error.message}`);
  }

  const again = await supabase
    .from("landing_user_feature_assignments")
    .select("bucket")
    .eq("auth_user_id", authUserId)
    .eq("feature_key", PAYMENT_ROBOKASSA_FEATURE_KEY)
    .maybeSingle();
  const persisted = Number((again.data as { bucket?: unknown } | null)?.bucket);
  if (Number.isInteger(persisted) && persisted >= 0 && persisted <= 9999) {
    return persisted;
  }
  return bucket;
}

export async function resolvePaymentProvider(input: {
  supabase: PaymentProviderStore;
  authUserId?: string | null;
  email?: string | null;
  nowMs?: number;
}): Promise<PaymentProvider> {
  try {
    const envProvider = getPaymentProvider();
    const unpaidProvider = input.authUserId
      ? await loadPinnedUnpaidProvider(
          input.supabase,
          input.authUserId,
          input.nowMs,
        )
      : null;
    if (unpaidProvider) return unpaidProvider;

    const { enabled, rolloutBps, canaryEmails } = await loadRolloutAndCanary(
      input.supabase,
    );
    const email = input.email?.trim().toLowerCase();
    if (email && canaryEmails.has(email)) return "robokassa";
    if (envProvider === "robokassa") return "robokassa";
    if (!enabled || rolloutBps <= 0 || !input.authUserId) return "yookassa";

    const assignmentBucket = await getOrAssignBucket(
      input.supabase,
      input.authUserId,
    );
    return decidePaymentProvider({
      email: input.email,
      unpaidProvider: null,
      canaryEmails,
      envProvider,
      rolloutEnabled: enabled,
      rolloutBps,
      assignmentBucket,
    });
  } catch (error) {
    console.warn("[payments] provider resolve failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return "yookassa";
  }
}
