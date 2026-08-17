import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { ensureLandingUserForGeneration } from "@/lib/ensure-landing-user";
import { getPricingPlan } from "@/lib/pricing-plans";
import { createYooKassaPayment } from "@/lib/yookassa-client";
import { assertYooKassaPaymentMatches } from "@/lib/yookassa-core";
import { buildYooKassaReturnUrl } from "@/lib/yookassa-return-path";
import {
  sanitizeYclid,
  sanitizeYmClientId,
} from "@/lib/yandex-attribution";
import { getPaymentProviderForEmail } from "@/lib/payment-provider";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type LocalPayment = {
  id: string;
  plan_id: string;
  amount_rub: number | string;
  credits: number;
  idempotency_key: string;
  yookassa_payment_id: string | null;
  confirmation_url: string | null;
};

function buildReturnUrl(
  localPaymentId: string,
  preserveTestAccess: boolean,
  returnPath: string | null,
): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!siteUrl) throw new Error("NEXT_PUBLIC_SITE_URL is not configured");
  return buildYooKassaReturnUrl({
    siteUrl,
    localPaymentId,
    returnPath,
    preserveTestAccess:
      preserveTestAccess || process.env.NODE_ENV !== "production",
  });
}

async function readExistingPayment(
  supabase: ReturnType<typeof createSupabaseServer>,
  authUserId: string,
  idempotencyKey: string,
): Promise<LocalPayment | null> {
  const { data, error } = await supabase
    .from("landing_yookassa_payments")
    .select(
      "id, plan_id, amount_rub, credits, idempotency_key, yookassa_payment_id, confirmation_url",
    )
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
    if (getPaymentProviderForEmail(user.email) !== "yookassa") {
      return NextResponse.json({ error: "provider_disabled" }, { status: 409 });
    }

    const body = (await request.json().catch(() => null)) as
      | {
          planId?: unknown;
          checkoutAttemptId?: unknown;
          testAccess?: unknown;
          returnPath?: unknown;
          ymClientId?: unknown;
          yclid?: unknown;
        }
      | null;
    const ymClientId = sanitizeYmClientId(body?.ymClientId);
    const yclid = sanitizeYclid(body?.yclid);
    const plan = getPricingPlan(body?.planId);
    const idempotencyKey =
      typeof body?.checkoutAttemptId === "string"
        ? body.checkoutAttemptId.trim()
        : "";
    if (!plan || !UUID_PATTERN.test(idempotencyKey)) {
      return NextResponse.json(
        { error: "invalid_request", message: "Некорректный пакет или идентификатор оплаты" },
        { status: 400 },
      );
    }

    const supabase = createSupabaseServer();
    let local = await readExistingPayment(supabase, user.id, idempotencyKey);
    if (local && local.plan_id !== plan.id) {
      return NextResponse.json({ error: "idempotency_conflict" }, { status: 409 });
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
        .from("landing_yookassa_payments")
        .insert({
          auth_user_id: user.id,
          landing_user_id: ensured.dbUserId,
          plan_id: plan.id,
          credits: plan.credits,
          amount_rub: plan.price,
          idempotency_key: idempotencyKey,
          status: "created",
          ym_client_id: ymClientId,
          yclid,
        })
        .select(
          "id, plan_id, amount_rub, credits, idempotency_key, yookassa_payment_id, confirmation_url",
        )
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

    if (ymClientId || yclid) {
      const now = new Date().toISOString();
      if (ymClientId) {
        const { error: clientIdError } = await supabase
          .from("landing_yookassa_payments")
          .update({ ym_client_id: ymClientId, updated_at: now })
          .eq("id", local.id)
          .is("ym_client_id", null);
        if (clientIdError) {
          console.warn("[yookassa] ym_client_id backfill skipped", {
            paymentId: local.id,
            message: clientIdError.message,
          });
        }
      }
      if (yclid) {
        const { error: yclidError } = await supabase
          .from("landing_yookassa_payments")
          .update({ yclid, updated_at: now })
          .eq("id", local.id)
          .is("yclid", null);
        if (yclidError) {
          console.warn("[yookassa] yclid backfill skipped", {
            paymentId: local.id,
            message: yclidError.message,
          });
        }
      }
    }

    if (local.confirmation_url && local.yookassa_payment_id) {
      return NextResponse.json({
        provider: "yookassa",
        paymentId: local.id,
        confirmationUrl: local.confirmation_url,
      });
    }

    const fixedPlan = {
      ...plan,
      price: Number(local.amount_rub),
      credits: local.credits,
    };
    const providerPayment = await createYooKassaPayment({
      localPaymentId: local.id,
      idempotencyKey: local.idempotency_key,
      plan: fixedPlan,
      returnUrl: buildReturnUrl(
        local.id,
        body?.testAccess === true,
        typeof body?.returnPath === "string" ? body.returnPath : null,
      ),
    });
    assertYooKassaPaymentMatches(providerPayment, {
      localPaymentId: local.id,
      planId: local.plan_id,
      priceRub: Number(local.amount_rub),
    });

    const confirmationUrl = providerPayment.confirmation?.confirmation_url;
    if (
      providerPayment.confirmation?.type !== "redirect" ||
      !confirmationUrl ||
      new URL(confirmationUrl).protocol !== "https:"
    ) {
      throw new Error("YooKassa did not return a secure redirect URL");
    }

    const { data: updated, error: updateError } = await supabase
      .from("landing_yookassa_payments")
      .update({
        yookassa_payment_id: providerPayment.id,
        confirmation_url: confirmationUrl,
        status: providerPayment.status === "canceled" ? "canceled" : "pending",
        provider_status: providerPayment.status,
        test: providerPayment.test,
        updated_at: new Date().toISOString(),
      })
      .eq("id", local.id)
      .in("status", ["created", "pending"])
      .select("id, confirmation_url, yookassa_payment_id")
      .maybeSingle();
    if (updateError) {
      console.error("[yookassa] local payment update failed", {
        paymentId: local.id,
        message: updateError.message,
      });
      throw new Error(`Payment local update failed: ${updateError.message}`);
    }
    if (!updated?.confirmation_url || !updated.yookassa_payment_id) {
      const { data: current, error: rereadError } = await supabase
        .from("landing_yookassa_payments")
        .select("id, confirmation_url, yookassa_payment_id, status")
        .eq("id", local.id)
        .maybeSingle();
      if (rereadError) {
        throw new Error(`Payment reread failed: ${rereadError.message}`);
      }
      if (current?.confirmation_url && current.yookassa_payment_id) {
        return NextResponse.json({
          provider: "yookassa",
          paymentId: current.id,
          confirmationUrl: current.confirmation_url,
        });
      }
      throw new Error("Payment is no longer open for checkout update");
    }

    return NextResponse.json({
      provider: "yookassa",
      paymentId: local.id,
      confirmationUrl: updated.confirmation_url,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[yookassa] create payment failed", { message });
    const notConfigured =
      message.includes("not configured") || message.includes("NEXT_PUBLIC_SITE_URL");
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
