import type { SupabaseClient } from "@supabase/supabase-js";
import {
  YANDEX_METRIKA_COUNTER_ID,
  YM_GOAL_PURCHASE,
} from "@/lib/yandex-metrika";
import { sanitizeYmClientId } from "@/lib/yandex-attribution";

export { YM_GOAL_PURCHASE };

const COLLECT_URL = "https://mc.yandex.ru/collect";
export const YANDEX_CONVERSION_MAX_RETRY_ATTEMPTS = 5;
export const YANDEX_CONVERSION_CLAIM_STALE_MS = 60_000;
export const YANDEX_CONVERSION_FLUSH_LIMIT = 20;

export const YANDEX_PURCHASE_LEDGER_TABLES = [
  "landing_yookassa_payments",
  "landing_robokassa_payments",
] as const;

export type YandexPurchaseLedgerTable =
  (typeof YANDEX_PURCHASE_LEDGER_TABLES)[number];

export type YandexPurchasePayload = {
  clientId: string;
  orderId: string;
  revenueRub: number;
  planId: string;
  credits: number;
};

export type ConversionPayment = {
  id: string;
  plan_id: string;
  credits: number;
  amount_rub: number | string;
  ym_client_id: string | null;
  yandex_conversion_sent_at: string | null;
  yandex_conversion_claimed_at?: string | null;
  yandex_conversion_attempts: number | null;
};

export type ReportYandexPurchaseDeps = {
  nowMs?: number;
  token?: string | null;
  send?: (
    payload: YandexPurchasePayload,
  ) => Promise<SendYandexPurchaseResult>;
};

/**
 * PostgREST applies PATCH filters to the *new* row. Never filter a column
 * that the same PATCH writes, and never use `.or()` with ISO timestamps.
 */
export function yandexConversionClaimMatch(paymentId: string): {
  id: string;
  sentAtIsNull: true;
} {
  return { id: paymentId, sentAtIsNull: true };
}

export function yandexConversionIdMatch(paymentId: string): { id: string } {
  return { id: paymentId };
}

export function isYandexConversionClaimOpen(input: {
  sentAt: string | null | undefined;
  claimedAt: string | null | undefined;
  attempts: number | null | undefined;
  nowMs: number;
}): boolean {
  if (input.sentAt) return false;
  if ((input.attempts ?? 0) >= YANDEX_CONVERSION_MAX_RETRY_ATTEMPTS) {
    return false;
  }
  if (!input.claimedAt) return true;
  const claimedMs = Date.parse(input.claimedAt);
  if (!Number.isFinite(claimedMs)) return true;
  return claimedMs < input.nowMs - YANDEX_CONVERSION_CLAIM_STALE_MS;
}

export function getYandexMetrikaMpToken(): string | null {
  const token = process.env.YANDEX_METRIKA_MP_TOKEN?.trim();
  return token ? token : null;
}

export function buildYandexPurchaseCollectParams(
  payload: YandexPurchasePayload,
  token: string,
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("tid", String(YANDEX_METRIKA_COUNTER_ID));
  params.set("cid", payload.clientId);
  params.set("t", "event");
  params.set("ea", YM_GOAL_PURCHASE);
  params.set("pa", "purchase");
  params.set("ti", payload.orderId);
  params.set("tr", String(payload.revenueRub));
  params.set("cu", "RUB");
  params.set("ev", String(payload.revenueRub));
  params.set("pr1id", payload.planId);
  params.set("pr1nm", payload.planId);
  params.set("pr1br", "PromptShot");
  params.set("pr1ca", "tokens");
  params.set("pr1pr", String(payload.revenueRub));
  params.set("pr1qt", "1");
  params.set("dl", "https://promptshot.ru/pricing");
  params.set("ms", token);
  return params;
}

export type SendYandexPurchaseResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "no_token"
        | "no_client_id"
        | "invalid_revenue"
        | "http_error"
        | "network_error";
      message?: string;
    };

export async function sendYandexPurchaseConversion(
  payload: YandexPurchasePayload,
): Promise<SendYandexPurchaseResult> {
  const token = getYandexMetrikaMpToken();
  if (!token) return { ok: false, reason: "no_token" };
  const clientId = sanitizeYmClientId(payload.clientId);
  if (!clientId) return { ok: false, reason: "no_client_id" };
  if (!Number.isFinite(payload.revenueRub) || payload.revenueRub <= 0) {
    return { ok: false, reason: "invalid_revenue" };
  }

  const body = buildYandexPurchaseCollectParams(
    { ...payload, clientId },
    token,
  ).toString();

  try {
    const response = await fetch(COLLECT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      return {
        ok: false,
        reason: "http_error",
        message: `metrika collect ${response.status}`,
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: "network_error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function reportYandexPurchase(
  supabase: SupabaseClient,
  payment: ConversionPayment,
  table: YandexPurchaseLedgerTable,
  deps: ReportYandexPurchaseDeps = {},
): Promise<void> {
  const nowMs = deps.nowMs ?? Date.now();
  if (
    !isYandexConversionClaimOpen({
      sentAt: payment.yandex_conversion_sent_at,
      claimedAt: payment.yandex_conversion_claimed_at,
      attempts: payment.yandex_conversion_attempts,
      nowMs,
    })
  ) {
    return;
  }

  const token =
    deps.token !== undefined ? deps.token : getYandexMetrikaMpToken();
  if (!token) {
    console.info("[metrika] purchase skipped", {
      paymentId: payment.id,
      reason: "no_token",
    });
    return;
  }

  const attempts = payment.yandex_conversion_attempts ?? 0;
  const claimAt = new Date(nowMs).toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from(table)
    .update({
      yandex_conversion_claimed_at: claimAt,
      yandex_conversion_attempts: attempts + 1,
      updated_at: claimAt,
    })
    .eq("id", payment.id)
    .is("yandex_conversion_sent_at", null)
    .select("id")
    .maybeSingle();
  if (claimError) {
    throw new Error(`Purchase conversion claim failed: ${claimError.message}`);
  }
  if (!claimed) return;

  const clientId = sanitizeYmClientId(payment.ym_client_id);
  const send = deps.send ?? sendYandexPurchaseConversion;

  if (!clientId) {
    await releaseConversionClaim(supabase, table, payment.id, "no_client_id");
    console.info("[metrika] purchase skipped", {
      paymentId: payment.id,
      reason: "no_client_id",
    });
    return;
  }

  const result = await send({
    clientId,
    orderId: payment.id,
    revenueRub: Number(payment.amount_rub),
    planId: payment.plan_id,
    credits: payment.credits,
  });

  if (result.ok) {
    const { error } = await supabase
      .from(table)
      .update({
        yandex_conversion_sent_at: new Date(nowMs).toISOString(),
        yandex_conversion_claimed_at: null,
        yandex_conversion_error: null,
        updated_at: new Date(nowMs).toISOString(),
      })
      .eq("id", payment.id);
    if (error) {
      console.error("[metrika] purchase mark-sent failed", {
        paymentId: payment.id,
        message: error.message,
      });
    } else {
      console.info("[metrika] purchase sent", { paymentId: payment.id });
    }
    return;
  }

  await releaseConversionClaim(
    supabase,
    table,
    payment.id,
    result.message || result.reason,
  );
  console.warn("[metrika] purchase send failed", {
    paymentId: payment.id,
    reason: result.reason,
  });
}

async function releaseConversionClaim(
  supabase: SupabaseClient,
  table: YandexPurchaseLedgerTable,
  paymentId: string,
  error: string,
): Promise<void> {
  const { error: updateError } = await supabase
    .from(table)
    .update({
      yandex_conversion_error: error.slice(0, 500),
      yandex_conversion_claimed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentId);
  if (updateError) {
    console.error("[metrika] purchase attempt update failed", {
      paymentId,
      message: updateError.message,
    });
  }
}

export function reportYandexYooKassaPurchase(
  supabase: SupabaseClient,
  payment: ConversionPayment,
  deps: ReportYandexPurchaseDeps = {},
): Promise<void> {
  return reportYandexPurchase(
    supabase,
    payment,
    "landing_yookassa_payments",
    deps,
  );
}

const CONVERSION_SELECT =
  "id, plan_id, credits, amount_rub, ym_client_id, yandex_conversion_sent_at, yandex_conversion_claimed_at, yandex_conversion_attempts";

export type FlushUnsentYandexPurchasesSummary = {
  scanned: number;
  reported: number;
  skipped: number;
};

export async function flushUnsentYandexPurchaseConversions(
  supabase: SupabaseClient,
  options: { limit?: number; nowMs?: number } = {},
): Promise<FlushUnsentYandexPurchasesSummary> {
  const limit = Math.max(
    1,
    Math.min(YANDEX_CONVERSION_FLUSH_LIMIT, options.limit ?? YANDEX_CONVERSION_FLUSH_LIMIT),
  );
  const nowMs = options.nowMs ?? Date.now();
  const staleBefore = new Date(
    nowMs - YANDEX_CONVERSION_CLAIM_STALE_MS,
  ).toISOString();

  const rows: Array<{ table: YandexPurchaseLedgerTable; payment: ConversionPayment }> =
    [];

  for (const table of YANDEX_PURCHASE_LEDGER_TABLES) {
    const [open, stale] = await Promise.all([
      loadUnsentConversions(supabase, table, {
        claimed: "open",
        limit,
      }),
      loadUnsentConversions(supabase, table, {
        claimed: "stale",
        staleBefore,
        limit,
      }),
    ]);
    const seen = new Set<string>();
    for (const payment of [...open, ...stale]) {
      if (seen.has(payment.id)) continue;
      seen.add(payment.id);
      rows.push({ table, payment });
    }
  }

  rows.sort((a, b) => a.payment.id.localeCompare(b.payment.id));
  const batch = rows.slice(0, limit);
  let reported = 0;
  let skipped = 0;

  for (const item of batch) {
    if (
      !isYandexConversionClaimOpen({
        sentAt: item.payment.yandex_conversion_sent_at,
        claimedAt: item.payment.yandex_conversion_claimed_at,
        attempts: item.payment.yandex_conversion_attempts,
        nowMs,
      })
    ) {
      skipped += 1;
      continue;
    }
    await reportYandexPurchase(supabase, item.payment, item.table, { nowMs });
    reported += 1;
  }

  console.info("[metrika] unsent flush", {
    scanned: batch.length,
    reported,
    skipped,
  });
  return { scanned: batch.length, reported, skipped };
}

async function loadUnsentConversions(
  supabase: SupabaseClient,
  table: YandexPurchaseLedgerTable,
  input: {
    claimed: "open" | "stale";
    staleBefore?: string;
    limit: number;
  },
): Promise<ConversionPayment[]> {
  let query = supabase
    .from(table)
    .select(CONVERSION_SELECT)
    .eq("status", "succeeded")
    .eq("test", false)
    .is("yandex_conversion_sent_at", null)
    .lt("yandex_conversion_attempts", YANDEX_CONVERSION_MAX_RETRY_ATTEMPTS);

  if (table === "landing_yookassa_payments") {
    query = query.not("credited_at", "is", null);
  }
  if (input.claimed === "open") {
    query = query.is("yandex_conversion_claimed_at", null);
  } else {
    query = query.lt(
      "yandex_conversion_claimed_at",
      input.staleBefore ?? new Date(0).toISOString(),
    );
  }

  const { data, error } = await query
    .order("created_at", { ascending: true })
    .limit(input.limit);
  if (error) {
    throw new Error(
      `Unsent ${table} conversion lookup failed: ${error.message}`,
    );
  }
  return (data ?? []) as ConversionPayment[];
}
