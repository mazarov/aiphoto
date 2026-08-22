import { after, NextResponse } from "next/server";
import {
  getRobokassaConfig,
  parseRobokassaResult,
  robokassaAmountsEqual,
  verifyRobokassaResult,
} from "@/lib/robokassa-core";
import { enqueueTokensCreditedMail } from "@/lib/mail-outbox";
import { createSupabaseServer } from "@/lib/supabase";
import { reportYandexPurchase } from "@/lib/yandex-metrika-measurement";

export const runtime = "nodejs";

type LocalPayment = {
  id: string;
  invoice_id: number | string;
  auth_user_id: string;
  landing_user_id: string;
  plan_id: string;
  credits: number;
  amount_rub: number | string;
  test: boolean;
  ym_client_id: string | null;
  yandex_conversion_sent_at: string | null;
  yandex_conversion_attempts: number | null;
};

async function readParams(request: Request): Promise<URLSearchParams> {
  if (request.method === "GET") return new URL(request.url).searchParams;
  return new URLSearchParams(await request.text());
}

async function handleResult(request: Request) {
  try {
    const config = getRobokassaConfig();
    const result = parseRobokassaResult(await readParams(request));
    if (!verifyRobokassaResult(result, config)) {
      return new NextResponse("bad sign", { status: 400 });
    }

    const supabase = createSupabaseServer();
    const { data, error } = await supabase
      .from("landing_robokassa_payments")
      .select(
        "id, invoice_id, auth_user_id, landing_user_id, plan_id, credits, amount_rub, test, ym_client_id, yandex_conversion_sent_at, yandex_conversion_attempts",
      )
      .eq("id", result.paymentId)
      .eq("invoice_id", result.invoiceId)
      .maybeSingle();
    if (error) throw new Error(`Payment lookup failed: ${error.message}`);
    if (!data) return new NextResponse("payment not found", { status: 404 });
    const local = data as LocalPayment;
    if (!robokassaAmountsEqual(result.outSum, Number(local.amount_rub))) {
      return new NextResponse("amount mismatch", { status: 400 });
    }

    const { data: fulfilled, error: fulfillError } = await supabase.rpc(
      "landing_fulfill_robokassa_payment",
      {
        p_payment_id: local.id,
        p_invoice_id: result.invoiceId,
        p_payment_method: result.paymentMethod,
        p_test: local.test,
      },
    );
    if (fulfillError) throw new Error(`Payment fulfillment failed: ${fulfillError.message}`);
    const fulfillment = Array.isArray(fulfilled) ? fulfilled[0] : fulfilled;

    after(async () => {
      if (fulfillment?.credited === true) {
        try {
          await enqueueTokensCreditedMail(supabase, {
            provider: "robokassa",
            paymentId: local.id,
            authUserId: local.auth_user_id,
            landingUserId: local.landing_user_id,
            planId: local.plan_id,
            credits: local.credits,
          });
        } catch (error) {
          console.warn("[mail] robokassa credited enqueue failed", {
            paymentId: local.id,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
      try {
        await reportYandexPurchase(
          supabase,
          local,
          "landing_robokassa_payments",
        );
      } catch (error) {
        console.warn("[metrika] robokassa purchase report failed", {
          paymentId: local.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    });
    console.info("[robokassa] result accepted", {
      paymentId: local.id,
      invoiceId: result.invoiceId,
      credited: fulfillment?.credited === true,
    });
    return new NextResponse(`OK${result.invoiceId}`, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("[robokassa] result failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return new NextResponse("result failed", { status: 500 });
  }
}

export const GET = handleResult;
export const POST = handleResult;
