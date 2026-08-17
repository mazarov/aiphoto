import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";

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
    const { data: payment, error } = await supabase
      .from("landing_robokassa_payments")
      .select("id, landing_user_id, plan_id, credits, amount_rub, status, credited_at")
      .eq("id", id)
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (error) throw new Error(`Payment status lookup failed: ${error.message}`);
    if (!payment) return NextResponse.json({ error: "not_found" }, { status: 404 });

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
        provider: "robokassa",
        paymentId: payment.id,
        planId: payment.plan_id,
        credits: payment.credits,
        amountRub: Number(payment.amount_rub),
        status: payment.status,
        creditedAt: payment.credited_at,
        balance,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[robokassa] payment status failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "status_failed", message: "Не удалось проверить оплату" },
      { status: 500 },
    );
  }
}
