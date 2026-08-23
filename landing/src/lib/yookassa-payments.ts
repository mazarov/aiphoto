import type { SupabaseClient } from "@supabase/supabase-js";
import { getYooKassaPayment } from "@/lib/yookassa-client";
import {
  assertYooKassaPaymentMatches,
  getYooKassaReconciliationAction,
} from "@/lib/yookassa-core";
import { enqueueTokensCreditedMail } from "@/lib/mail-outbox";
import { reportYandexYooKassaPurchase } from "@/lib/yandex-metrika-measurement";

type LocalPayment = {
  id: string;
  auth_user_id: string;
  landing_user_id: string;
  plan_id: string;
  credits: number;
  amount_rub: number | string;
  yookassa_payment_id: string | null;
  status: "created" | "pending" | "succeeded" | "canceled";
  credited_at: string | null;
  ym_client_id: string | null;
  yandex_conversion_sent_at: string | null;
  yandex_conversion_attempts: number | null;
};

export type ReconcileResult = {
  paymentId: string;
  status: LocalPayment["status"];
  credited: boolean;
  creditsAfter: number | null;
};

export async function reconcileYooKassaPayment(
  supabase: SupabaseClient,
  providerPaymentId: string,
): Promise<ReconcileResult> {
  const providerPayment = await getYooKassaPayment(providerPaymentId);
  const localPaymentId = providerPayment.metadata.local_payment_id;
  if (!localPaymentId) {
    throw new Error("YooKassa payment has no local_payment_id");
  }

  const { data, error } = await supabase
    .from("landing_yookassa_payments")
    .select(
      "id, auth_user_id, landing_user_id, plan_id, credits, amount_rub, yookassa_payment_id, status, credited_at, ym_client_id, yandex_conversion_sent_at, yandex_conversion_attempts",
    )
    .eq("id", localPaymentId)
    .maybeSingle();

  if (error) throw new Error(`Payment lookup failed: ${error.message}`);
  if (!data) throw new Error("Local YooKassa payment not found");
  const local = data as LocalPayment;

  assertYooKassaPaymentMatches(providerPayment, {
    localPaymentId: local.id,
    planId: local.plan_id,
    priceRub: Number(local.amount_rub),
  });

  if (
    local.yookassa_payment_id &&
    local.yookassa_payment_id !== providerPayment.id
  ) {
    throw new Error("YooKassa provider payment id mismatch");
  }

  if (!local.yookassa_payment_id) {
    const { error: attachError } = await supabase
      .from("landing_yookassa_payments")
      .update({
        yookassa_payment_id: providerPayment.id,
        test: providerPayment.test,
        updated_at: new Date().toISOString(),
      })
      .eq("id", local.id)
      .is("yookassa_payment_id", null);
    if (attachError) {
      throw new Error(`Payment provider id attach failed: ${attachError.message}`);
    }
  }

  const action = getYooKassaReconciliationAction(providerPayment);
  if (action === "fulfill") {
    const { data: fulfilled, error: fulfillError } = await supabase.rpc(
      "landing_fulfill_yookassa_payment",
      {
        p_payment_id: local.id,
        p_yookassa_payment_id: providerPayment.id,
        p_test: providerPayment.test,
      },
    );
    if (fulfillError) {
      throw new Error(`Payment fulfillment failed: ${fulfillError.message}`);
    }

    const result = Array.isArray(fulfilled) ? fulfilled[0] : fulfilled;
    if (result?.credited === true) {
      try {
        await enqueueTokensCreditedMail(supabase, {
          provider: "yookassa",
          paymentId: local.id,
          authUserId: local.auth_user_id,
          landingUserId: local.landing_user_id,
          planId: local.plan_id,
          credits: local.credits,
        });
      } catch (error) {
        console.warn("[mail] yookassa credited enqueue failed", {
          paymentId: local.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    try {
      await reportYandexYooKassaPurchase(supabase, local);
    } catch (error) {
      console.warn("[metrika] purchase report failed", {
        paymentId: local.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return {
      paymentId: local.id,
      status: "succeeded",
      credited: result?.credited === true,
      creditsAfter:
        typeof result?.credits_after === "number"
          ? result.credits_after
          : null,
    };
  }

  if (action === "cancel") {
    if (!local.credited_at) {
      const { error: cancelError } = await supabase
        .from("landing_yookassa_payments")
        .update({
          status: "canceled",
          provider_status: "canceled",
          test: providerPayment.test,
          updated_at: new Date().toISOString(),
        })
        .eq("id", local.id)
        .is("credited_at", null);
      if (cancelError) {
        throw new Error(`Payment cancellation update failed: ${cancelError.message}`);
      }
    }
    return {
      paymentId: local.id,
      status: local.credited_at ? "succeeded" : "canceled",
      credited: false,
      creditsAfter: null,
    };
  }

  const { error: pendingError } = await supabase
    .from("landing_yookassa_payments")
    .update({
      status: "pending",
      provider_status: providerPayment.status,
      test: providerPayment.test,
      updated_at: new Date().toISOString(),
    })
    .eq("id", local.id)
    .in("status", ["created", "pending"]);
  if (pendingError) {
    throw new Error(`Payment pending update failed: ${pendingError.message}`);
  }

  return {
    paymentId: local.id,
    status: local.credited_at ? "succeeded" : "pending",
    credited: false,
    creditsAfter: null,
  };
}

export type OpenReconcileSource = "open" | "create";

export type OpenReconcileCredited = {
  paymentId: string;
  planId: string;
  credits: number;
  creditsAfter: number | null;
};

export type OpenReconcileSummary = {
  scanned: number;
  credited: OpenReconcileCredited[];
  skippedByCooldown: boolean;
};

export type OpenReconcileOptions = {
  limit?: number;
  source?: OpenReconcileSource;
  nowMs?: number;
  cooldownMs?: number;
  cooldownStore?: Map<string, number>;
  skipCooldown?: boolean;
  reconcilePayment?: (
    supabase: SupabaseClient,
    providerPaymentId: string,
  ) => Promise<ReconcileResult>;
};

export const DEFAULT_OPEN_RECONCILE_LIMIT = 5;
export const OPEN_RECONCILE_COOLDOWN_MS = 15_000;

const openReconcileCooldown = new Map<string, number>();

export function pickAlreadyCreditedOpenPayment(
  credited: OpenReconcileCredited[],
  planId: string,
): OpenReconcileCredited | null {
  return credited.find((item) => item.planId === planId) ?? null;
}

export async function reconcileOpenYooKassaPaymentsForAuthUser(
  supabase: SupabaseClient,
  authUserId: string,
  options: OpenReconcileOptions = {},
): Promise<OpenReconcileSummary> {
  const source = options.source ?? "open";
  const nowMs = options.nowMs ?? Date.now();
  const cooldownStore = options.cooldownStore ?? openReconcileCooldown;
  const cooldownMs = options.skipCooldown
    ? 0
    : (options.cooldownMs ?? (source === "create" ? 0 : OPEN_RECONCILE_COOLDOWN_MS));
  const limit = Math.max(
    1,
    Math.min(DEFAULT_OPEN_RECONCILE_LIMIT, options.limit ?? DEFAULT_OPEN_RECONCILE_LIMIT),
  );
  const reconcilePayment = options.reconcilePayment ?? reconcileYooKassaPayment;

  if (cooldownMs > 0) {
    const last = cooldownStore.get(authUserId);
    if (last != null && nowMs - last < cooldownMs) {
      console.info("[yookassa] open_reconcile", {
        source,
        scanned: 0,
        credited: 0,
        skippedByCooldown: true,
      });
      return { scanned: 0, credited: [], skippedByCooldown: true };
    }
    cooldownStore.set(authUserId, nowMs);
  }

  const { data, error } = await supabase
    .from("landing_yookassa_payments")
    .select("id, plan_id, credits, yookassa_payment_id")
    .eq("auth_user_id", authUserId)
    .in("status", ["created", "pending"])
    .not("yookassa_payment_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Open payment lookup failed: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    plan_id: string;
    credits: number;
    yookassa_payment_id: string | null;
  }>;
  const credited: OpenReconcileCredited[] = [];

  for (const row of rows) {
    const providerPaymentId = row.yookassa_payment_id;
    if (!providerPaymentId) continue;
    try {
      const result = await reconcilePayment(supabase, providerPaymentId);
      if (result.credited) {
        credited.push({
          paymentId: result.paymentId,
          planId: row.plan_id,
          credits: row.credits,
          creditsAfter: result.creditsAfter,
        });
      }
    } catch (error) {
      console.warn("[yookassa] open_reconcile item failed", {
        paymentId: row.id,
        providerPaymentId,
        source,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.info("[yookassa] open_reconcile", {
    source,
    scanned: rows.length,
    credited: credited.length,
    skippedByCooldown: false,
  });

  return { scanned: rows.length, credited, skippedByCooldown: false };
}

export type StaleReconcileOptions = {
  olderThanMinutes?: number;
  limit?: number;
};

export type StaleReconcileItem =
  | {
      ok: true;
      providerPaymentId: string;
      result: ReconcileResult;
    }
  | {
      ok: false;
      providerPaymentId: string;
      paymentId: string | null;
      message: string;
    };

export type StaleReconcileSummary = {
  scanned: number;
  ok: number;
  failed: number;
  olderThanMinutes: number;
  limit: number;
  results: StaleReconcileItem[];
};

export const DEFAULT_STALE_OLDER_THAN_MINUTES = 1;
const DEFAULT_STALE_LIMIT = 20;

export async function reconcileStaleYooKassaPayments(
  supabase: SupabaseClient,
  options: StaleReconcileOptions = {},
): Promise<StaleReconcileSummary> {
  const olderThanMinutes = Math.max(
    1,
    Math.min(24 * 60, options.olderThanMinutes ?? DEFAULT_STALE_OLDER_THAN_MINUTES),
  );
  const limit = Math.max(1, Math.min(50, options.limit ?? DEFAULT_STALE_LIMIT));
  const cutoffIso = new Date(Date.now() - olderThanMinutes * 60_000).toISOString();

  const { data, error } = await supabase
    .from("landing_yookassa_payments")
    .select("id, yookassa_payment_id")
    .in("status", ["created", "pending"])
    .not("yookassa_payment_id", "is", null)
    .lt("created_at", cutoffIso)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Stale payment lookup failed: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    yookassa_payment_id: string | null;
  }>;
  const results: StaleReconcileItem[] = [];
  let ok = 0;
  let failed = 0;

  for (const row of rows) {
    const providerPaymentId = row.yookassa_payment_id;
    if (!providerPaymentId) continue;
    try {
      const result = await reconcileYooKassaPayment(supabase, providerPaymentId);
      ok += 1;
      results.push({ ok: true, providerPaymentId, result });
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error("[yookassa] stale_reconcile item failed", {
        paymentId: row.id,
        providerPaymentId,
        message,
      });
      results.push({
        ok: false,
        providerPaymentId,
        paymentId: row.id,
        message,
      });
    }
  }

  console.info("[yookassa] stale_reconcile", {
    scanned: rows.length,
    ok,
    failed,
    olderThanMinutes,
    limit,
    source: "cron",
  });

  return {
    scanned: rows.length,
    ok,
    failed,
    olderThanMinutes,
    limit,
    results,
  };
}
