import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { parseLiveMailOffer } from "@/lib/mail-checkout-offer";
import { UNPAID_BANNER_TTL_MS } from "@/lib/unpaid-checkout-banner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EMPTY_HEADERS = { "Cache-Control": "private, no-store" };

/** Fresh Response per call — a module-level NextResponse is a locked body after the first send. */
function emptyBannerResponse(): NextResponse {
  return NextResponse.json({ banner: null }, { headers: EMPTY_HEADERS });
}

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(request);
    if (authError || !user || user.is_anonymous === true) {
      return emptyBannerResponse();
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
    if (!payment) return emptyBannerResponse();

    const createdAtMs = Date.parse(String(payment.created_at || ""));
    if (!Number.isFinite(createdAtMs) || Date.now() - createdAtMs >= UNPAID_BANNER_TTL_MS) {
      return emptyBannerResponse();
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
      { headers: EMPTY_HEADERS },
    );
  } catch (error) {
    console.warn("[yookassa] unpaid_banner failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return emptyBannerResponse();
  }
}
