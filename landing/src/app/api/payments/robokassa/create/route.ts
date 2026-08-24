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
import { sanitizePricingPaywallVariant } from "@/lib/pricing-paywall-attribution";
import {
  resolvePaymentTrafficSource,
  shouldWriteLandingUserAttribution,
} from "@/lib/payment-attribution";
import { sanitizeUuid } from "@/lib/visitor-id";
import { applyCheckoutOffer } from "@/lib/mail-checkout-offer";

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
          paywallVariant?: unknown;
          visitorId?: unknown;
          sessionId?: unknown;
          utm_source?: unknown;
          utm_medium?: unknown;
          utm_campaign?: unknown;
          utm_content?: unknown;
          utm_term?: unknown;
          utm_landing_path?: unknown;
        }
      | null;
    const paywallVariant = sanitizePricingPaywallVariant(body?.paywallVariant);
    const plan = getPricingPlan(body?.planId, paywallVariant ?? "treatment");
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
    const visitorId = sanitizeUuid(body?.visitorId);
    const sessionId = sanitizeUuid(body?.sessionId);
    const supabase = createSupabaseServer();
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
    const { data: landingUser } = await supabase
      .from("landing_users")
      .select("utm_source, utm_medium, utm_campaign, utm_content, utm_term, utm_landing_path, yclid")
      .eq("id", ensured.dbUserId)
      .maybeSingle();
    const trafficSource = resolvePaymentTrafficSource(body, landingUser, {
      checkoutYclid: yclid,
      userYclid: landingUser?.yclid ?? null,
    });
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
          visitor_id: visitorId,
          session_id: sessionId,
          ...trafficSource,
          paywall_variant: paywallVariant,
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

    if (shouldWriteLandingUserAttribution(trafficSource, yclid)) {
      await supabase
        .from("landing_users")
        .update({
          ...trafficSource,
          ...(yclid ? { yclid } : {}),
          attribution_captured_at: new Date().toISOString(),
        })
        .eq("id", ensured.dbUserId);
    }
    if (visitorId) {
      await supabase.rpc("upsert_landing_acquisition_visitor", {
        p_visitor_id: visitorId,
        p_utm_source: trafficSource.utm_source,
        p_utm_medium: trafficSource.utm_medium,
        p_utm_campaign: trafficSource.utm_campaign,
        p_utm_content: trafficSource.utm_content,
        p_utm_term: trafficSource.utm_term,
        p_utm_landing_path: trafficSource.utm_landing_path,
        p_yclid: yclid,
      });
      await supabase.rpc("attach_landing_visitor_to_user", {
        p_visitor_id: visitorId,
        p_landing_user_id: ensured.dbUserId,
        p_auth_user_id: user.id,
      });
    }

    if (paywallVariant) {
      const { error: variantError } = await supabase
        .from("landing_robokassa_payments")
        .update({
          paywall_variant: paywallVariant,
          updated_at: new Date().toISOString(),
        })
        .eq("id", local.id)
        .is("paywall_variant", null);
      if (variantError) {
        console.warn("[robokassa] paywall_variant backfill skipped", {
          paymentId: local.id,
          message: variantError.message,
        });
      }
    }
    for (const [field, value] of Object.entries({
      ym_client_id: ymClientId,
      yclid,
    })) {
      if (value == null) continue;
      await supabase
        .from("landing_robokassa_payments")
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq("id", local.id)
        .is(field, null);
    }
    for (const [field, value] of Object.entries({
      visitor_id: visitorId,
      session_id: sessionId,
    })) {
      if (value == null) continue;
      const { error: attributionError } = await supabase
        .from("landing_robokassa_payments")
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq("id", local.id)
        .is(field, null);
      if (attributionError) {
        console.warn("[robokassa] attribution backfill skipped", {
          paymentId: local.id,
          field,
          message: attributionError.message,
        });
      }
    }
    if (shouldWriteLandingUserAttribution(trafficSource, yclid)) {
      const { error: trafficError } = await supabase
        .from("landing_robokassa_payments")
        .update({
          ...trafficSource,
          updated_at: new Date().toISOString(),
        })
        .eq("id", local.id);
      if (trafficError) {
        console.warn("[robokassa] traffic source update skipped", {
          paymentId: local.id,
          message: trafficError.message,
        });
      }
    }

    const quote = await applyCheckoutOffer(supabase, {
      sharedUserId: ensured.dbUserId,
      paymentId: local.id,
      provider: "robokassa",
      catalogAmount: plan.price,
    });
    local = { ...local, amount_rub: quote.amountRub };

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
