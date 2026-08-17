import { type NextRequest, NextResponse } from "next/server";
import { ensureLandingUserForGeneration } from "@/lib/ensure-landing-user";
import { getPaymentProviderForEmail } from "@/lib/payment-provider";
import { getPricingPlan } from "@/lib/pricing-plans";
import {
  buildRobokassaCheckoutPayload,
  getRobokassaConfig,
} from "@/lib/robokassa-core";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { sanitizeYclid, sanitizeYmClientId } from "@/lib/yandex-attribution";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type LocalPayment = {
  id: string;
  invoice_id: number | string;
  plan_id: string;
  amount_rub: number | string;
  credits: number;
  idempotency_key: string;
  status: "created" | "pending" | "succeeded" | "canceled";
};

async function readExistingPayment(
  supabase: ReturnType<typeof createSupabaseServer>,
  authUserId: string,
  idempotencyKey: string,
): Promise<LocalPayment | null> {
  const { data, error } = await supabase
    .from("landing_robokassa_payments")
    .select("id, invoice_id, plan_id, amount_rub, credits, idempotency_key, status")
    .eq("auth_user_id", authUserId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (error) throw new Error(`Payment lookup failed: ${error.message}`);
  return (data as LocalPayment | null) ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(request);
    if (authError || !user || user.is_anonymous === true) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (getPaymentProviderForEmail(user.email) !== "robokassa") {
      return NextResponse.json({ error: "provider_disabled" }, { status: 409 });
    }
    const config = getRobokassaConfig();

    const body = (await request.json().catch(() => null)) as
      | {
          planId?: unknown;
          checkoutAttemptId?: unknown;
          ymClientId?: unknown;
          yclid?: unknown;
        }
      | null;
    const plan = getPricingPlan(body?.planId);
    const idempotencyKey =
      typeof body?.checkoutAttemptId === "string" ? body.checkoutAttemptId.trim() : "";
    if (!plan || !UUID_PATTERN.test(idempotencyKey)) {
      return NextResponse.json(
        { error: "invalid_request", message: "Некорректный пакет или идентификатор оплаты" },
        { status: 400 },
      );
    }

    const ymClientId = sanitizeYmClientId(body?.ymClientId);
    const yclid = sanitizeYclid(body?.yclid);
    const supabase = createSupabaseServer();
    let local = await readExistingPayment(supabase, user.id, idempotencyKey);
    if (local && local.plan_id !== plan.id) {
      return NextResponse.json({ error: "idempotency_conflict" }, { status: 409 });
    }
    if (local?.status === "succeeded" || local?.status === "canceled") {
      return NextResponse.json(
        { error: "payment_closed", message: "Эта попытка оплаты уже завершена" },
        { status: 409 },
      );
    }

    if (!local) {
      const ensured = await ensureLandingUserForGeneration(supabase, user);
      if (!ensured.ok || ensured.usedGuestOwner) {
        const status = ensured.ok ? 401 : ensured.status;
        return NextResponse.json(
          {
            error: ensured.ok ? "unauthorized" : ensured.error,
            message: ensured.ok
              ? "Для оплаты войдите через Google или Яндекс"
              : ensured.message,
          },
          { status },
        );
      }
      const { data: inserted, error: insertError } = await supabase
        .from("landing_robokassa_payments")
        .insert({
          auth_user_id: user.id,
          landing_user_id: ensured.dbUserId,
          plan_id: plan.id,
          credits: plan.credits,
          amount_rub: plan.price,
          idempotency_key: idempotencyKey,
          status: "created",
          test: config.testMode,
          ym_client_id: ymClientId,
          yclid,
        })
        .select("id, invoice_id, plan_id, amount_rub, credits, idempotency_key, status")
        .single();
      if (insertError || !inserted) {
        if (insertError?.code === "23505") {
          local = await readExistingPayment(supabase, user.id, idempotencyKey);
        }
        if (!local) {
          throw new Error(`Payment insert failed: ${insertError?.message ?? "unknown"}`);
        }
      } else {
        local = inserted as LocalPayment;
      }
    }

    const fixedPlan = {
      ...plan,
      price: Number(local.amount_rub),
      credits: local.credits,
    };
    const payload = buildRobokassaCheckoutPayload({
      paymentId: local.id,
      invoiceId: Number(local.invoice_id),
      plan: fixedPlan,
      email: user.email,
      config,
    });
    const { error: updateError } = await supabase
      .from("landing_robokassa_payments")
      .update({
        status: "pending",
        provider_status: "invoice_created",
        updated_at: new Date().toISOString(),
      })
      .eq("id", local.id)
      .in("status", ["created", "pending"]);
    if (updateError) throw new Error(`Payment update failed: ${updateError.message}`);

    return NextResponse.json({
      provider: "robokassa",
      paymentId: local.id,
      payload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[robokassa] create payment failed", { message });
    const notConfigured =
      message.includes("not configured") || message.includes("PAYMENT_PROVIDER");
    return NextResponse.json(
      {
        error: notConfigured ? "payment_unavailable" : "payment_create_failed",
        message: notConfigured
          ? "Оплата временно недоступна"
          : "Не удалось создать оплату. Попробуйте ещё раз.",
      },
      { status: notConfigured ? 503 : 502 },
    );
  }
}
