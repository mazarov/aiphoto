import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAdmin } from "@/lib/analytics-admin";
import { createSupabaseServer } from "@/lib/supabase";
import {
  reconcileStaleYooKassaPayments,
  reconcileYooKassaPayment,
} from "@/lib/yookassa-payments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ReconcileBody = {
  paymentId?: unknown;
  yookassaPaymentId?: unknown;
  stale?: unknown;
  olderThanMinutes?: unknown;
  limit?: unknown;
};

function asOptionalUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return UUID_PATTERN.test(trimmed) ? trimmed : null;
}

function asOptionalProviderId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asOptionalPositiveInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.trunc(value);
}

export async function POST(req: NextRequest) {
  const gate = await requireAnalyticsAdmin(req);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = (await req.json().catch(() => null)) as ReconcileBody | null;
  if (!body) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const supabase = createSupabaseServer();

  try {
    if (body.stale === true) {
      const summary = await reconcileStaleYooKassaPayments(supabase, {
        olderThanMinutes: asOptionalPositiveInt(body.olderThanMinutes),
        limit: asOptionalPositiveInt(body.limit),
      });
      console.info("[admin.payments] stale_reconcile", {
        adminEmail: gate.email,
        scanned: summary.scanned,
        ok: summary.ok,
        failed: summary.failed,
      });
      return NextResponse.json(summary, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const paymentId = asOptionalUuid(body.paymentId);
    let yookassaPaymentId = asOptionalProviderId(body.yookassaPaymentId);

    if (!yookassaPaymentId && paymentId) {
      const { data, error } = await supabase
        .from("landing_yookassa_payments")
        .select("yookassa_payment_id")
        .eq("id", paymentId)
        .maybeSingle();
      if (error) {
        throw new Error(`Payment lookup failed: ${error.message}`);
      }
      yookassaPaymentId =
        typeof data?.yookassa_payment_id === "string"
          ? data.yookassa_payment_id
          : null;
      if (!yookassaPaymentId) {
        return NextResponse.json(
          { error: "provider_id_missing", message: "У платежа нет YooKassa ID" },
          { status: 409 },
        );
      }
    }

    if (!yookassaPaymentId) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const result = await reconcileYooKassaPayment(supabase, yookassaPaymentId);
    console.info("[admin.payments] reconcile", {
      adminEmail: gate.email,
      paymentId: result.paymentId,
      status: result.status,
      credited: result.credited,
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[admin.payments] reconcile_failed", {
      adminEmail: gate.email,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "reconcile_failed", message: "Не удалось сверить оплату" },
      { status: 502 },
    );
  }
}
