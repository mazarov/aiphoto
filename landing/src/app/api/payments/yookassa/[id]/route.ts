import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { reconcileYooKassaPayment } from "@/lib/yookassa-payments";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(request);
    if (authError || !user || user.is_anonymous === true) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createSupabaseServer();
    const { data: initial, error: readError } = await supabase
      .from("landing_yookassa_payments")
      .select(
        "id, landing_user_id, plan_id, credits, status, credited_at, yookassa_payment_id",
      )
      .eq("id", id)
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (readError) throw new Error(`Payment status lookup failed: ${readError.message}`);
    if (!initial) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (
      (initial.status === "created" || initial.status === "pending") &&
      initial.yookassa_payment_id
    ) {
      try {
        await reconcileYooKassaPayment(supabase, initial.yookassa_payment_id);
      } catch (error) {
        console.warn("[yookassa] return reconciliation deferred", {
          paymentId: initial.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const { data: payment, error: finalReadError } = await supabase
      .from("landing_yookassa_payments")
      .select("id, landing_user_id, plan_id, credits, status, credited_at")
      .eq("id", id)
      .eq("auth_user_id", user.id)
      .single();
    if (finalReadError || !payment) {
      throw new Error(`Payment status refresh failed: ${finalReadError?.message ?? "unknown"}`);
    }

    let balance: number | null = null;
    if (payment.status === "succeeded") {
      const { data: profile } = await supabase
        .from("landing_users")
        .select("credits")
        .eq("id", payment.landing_user_id)
        .maybeSingle();
      balance = typeof profile?.credits === "number" ? profile.credits : null;
    }

    return NextResponse.json(
      {
        paymentId: payment.id,
        planId: payment.plan_id,
        credits: payment.credits,
        status: payment.status,
        creditedAt: payment.credited_at,
        balance,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    console.error("[yookassa] payment status failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "status_failed", message: "Не удалось проверить оплату" },
      { status: 500 },
    );
  }
}
