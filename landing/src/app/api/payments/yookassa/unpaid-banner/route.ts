import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { parseLiveMailOffer } from "@/lib/mail-checkout-offer";
import { UNPAID_BANNER_TTL_MS } from "@/lib/unpaid-checkout-banner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const empty = NextResponse.json(
  { banner: null },
  { headers: { "Cache-Control": "private, no-store" } },
);

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(request);
    if (authError || !user || user.is_anonymous === true) {
      return empty;
    }

    const supabase = createSupabaseServer();
    const { data: payment, error: readError } = await supabase
      .from("landing_yookassa_payments")
      .select("id, landing_user_id, plan_id, credits, created_at, credited_at, status")
      .eq("auth_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (readError) {
      throw new Error(`unpaid banner lookup failed: ${readError.message}`);
    }
    if (!payment) return empty;

    const createdAtMs = Date.parse(String(payment.created_at || ""));
    if (!Number.isFinite(createdAtMs) || Date.now() - createdAtMs >= UNPAID_BANNER_TTL_MS) {
      return empty;
    }

    const { data: offerRow } = await supabase.rpc("landing_live_pricing_offer", {
      p_shared_user_id: payment.landing_user_id,
    });

    return NextResponse.json(
      {
        banner: {
          paymentId: payment.id,
          planId: payment.plan_id,
          credits: payment.credits,
          createdAt: payment.created_at,
          creditedAt: payment.credited_at,
          status: payment.status,
          offer: parseLiveMailOffer(offerRow),
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.warn("[yookassa] unpaid_banner failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return empty;
  }
}
