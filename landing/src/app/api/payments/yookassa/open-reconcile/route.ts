import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { reconcileOpenYooKassaPaymentsForAuthUser } from "@/lib/yookassa-payments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(request);
    if (authError || !user || user.is_anonymous === true) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const supabase = createSupabaseServer();
    const summary = await reconcileOpenYooKassaPaymentsForAuthUser(
      supabase,
      user.id,
      { source: "open" },
    );
    const credited = summary.credited;
    return NextResponse.json(
      {
        scanned: summary.scanned,
        credited,
        creditsAfter: credited.at(-1)?.creditsAfter ?? null,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    console.warn("[yookassa] open_reconcile failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { scanned: 0, credited: [], creditsAfter: null },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  }
}
