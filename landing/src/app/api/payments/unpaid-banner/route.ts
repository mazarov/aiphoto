import { type NextRequest, NextResponse } from "next/server";
import { loadUnpaidBannerSnapshot } from "@/lib/unpaid-banner-snapshot";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EMPTY_HEADERS = { "Cache-Control": "private, no-store" };

function emptyBannerResponse(): NextResponse {
  return NextResponse.json({ banner: null }, { headers: EMPTY_HEADERS });
}

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(request);
    if (authError || !user || user.is_anonymous === true) {
      return emptyBannerResponse();
    }

    const banner = await loadUnpaidBannerSnapshot(createSupabaseServer(), user.id);
    return NextResponse.json({ banner }, { headers: EMPTY_HEADERS });
  } catch (error) {
    console.warn("[payments] unpaid_banner failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return emptyBannerResponse();
  }
}
