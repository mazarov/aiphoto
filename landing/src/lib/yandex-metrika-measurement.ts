import type { SupabaseClient } from "@supabase/supabase-js";
import {
  YANDEX_METRIKA_COUNTER_ID,
  YM_GOAL_PURCHASE,
} from "@/lib/yandex-metrika";
import { sanitizeYmClientId } from "@/lib/yandex-attribution";

export { YM_GOAL_PURCHASE };

const COLLECT_URL = "https://mc.yandex.ru/collect";
const MAX_RETRY_ATTEMPTS = 5;

export type YandexPurchasePayload = {
  clientId: string;
  orderId: string;
  revenueRub: number;
  planId: string;
  credits: number;
};

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
  | { ok: false; reason: "no_token" | "no_client_id" | "invalid_revenue" | "http_error" | "network_error"; message?: string };

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

type ConversionPayment = {
  id: string;
  plan_id: string;
  credits: number;
  amount_rub: number | string;
  ym_client_id: string | null;
  yandex_conversion_sent_at: string | null;
  yandex_conversion_attempts: number | null;
};

export async function reportYandexPurchase(
  supabase: SupabaseClient,
  payment: ConversionPayment,
  table: "landing_yookassa_payments" | "landing_robokassa_payments",
): Promise<void> {
  if (payment.yandex_conversion_sent_at) return;

  const attempts = payment.yandex_conversion_attempts ?? 0;
  if (attempts >= MAX_RETRY_ATTEMPTS) return;
  const claimAt = new Date().toISOString();
  const staleBefore = new Date(Date.now() - 60_000).toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from(table)
    .update({
      yandex_conversion_claimed_at: claimAt,
      yandex_conversion_attempts: attempts + 1,
      updated_at: claimAt,
    })
    .eq("id", payment.id)
    .is("yandex_conversion_sent_at", null)
    .or(
      `yandex_conversion_claimed_at.is.null,yandex_conversion_claimed_at.lt.${staleBefore}`,
    )
    .select("id")
    .maybeSingle();
  if (claimError) {
    throw new Error(`Purchase conversion claim failed: ${claimError.message}`);
  }
  if (!claimed) return;

  const clientId = sanitizeYmClientId(payment.ym_client_id);
  const token = getYandexMetrikaMpToken();

  if (!clientId || !token) {
    const reason = !token ? "no_token" : "no_client_id";
    await releaseConversionClaim(supabase, table, payment.id, claimAt, reason);
    console.info("[metrika] purchase skipped", {
      paymentId: payment.id,
      reason,
    });
    return;
  }

  const result = await sendYandexPurchaseConversion({
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
        yandex_conversion_sent_at: new Date().toISOString(),
        yandex_conversion_claimed_at: null,
        yandex_conversion_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id)
      .eq("yandex_conversion_claimed_at", claimAt)
      .is("yandex_conversion_sent_at", null);
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
    claimAt,
    result.message || result.reason,
  );
  console.warn("[metrika] purchase send failed", {
    paymentId: payment.id,
    reason: result.reason,
  });
}

async function releaseConversionClaim(
  supabase: SupabaseClient,
  table: "landing_yookassa_payments" | "landing_robokassa_payments",
  paymentId: string,
  claimAt: string,
  error: string,
): Promise<void> {
  const { error: updateError } = await supabase
    .from(table)
    .update({
      yandex_conversion_error: error.slice(0, 500),
      yandex_conversion_claimed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentId)
    .eq("yandex_conversion_claimed_at", claimAt)
    .is("yandex_conversion_sent_at", null);
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
): Promise<void> {
  return reportYandexPurchase(supabase, payment, "landing_yookassa_payments");
}
