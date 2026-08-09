import type { SupabaseClient } from "@supabase/supabase-js";
import { getYooKassaPayment } from "@/lib/yookassa-client";
import {
  assertYooKassaPaymentMatches,
  getYooKassaReconciliationAction,
} from "@/lib/yookassa-core";

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
      "id, auth_user_id, landing_user_id, plan_id, credits, amount_rub, yookassa_payment_id, status, credited_at",
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
