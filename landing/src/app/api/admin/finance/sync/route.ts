import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAdmin } from "@/lib/analytics-admin";
import { financeSyncMonth, syncDirectAdsMonth } from "@/lib/finance-direct-sync";
import { createSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const gate = await requireAnalyticsAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json().catch(() => ({}));
  const periodMonth = financeSyncMonth(
    typeof body === "object" && body && "month" in body ? String(body.month || "") : null,
  );
  if (!periodMonth) {
    return NextResponse.json({ error: "invalid_filter" }, { status: 400 });
  }

  const result = await syncDirectAdsMonth({
    supabase: createSupabaseServer(),
    periodMonth,
    uploadedByEmail: gate.email,
  });
  if (!result.ok) {
    if (result.error === "missing_direct_token") {
      return NextResponse.json(
        { ok: false, ads: "missing_token", periodMonth },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error("[admin.finance] direct_sync_failed", {
      adminEmail: gate.email,
      periodMonth,
      message: result.message,
    });
    return NextResponse.json({ error: "direct_sync_failed" }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    ads: "direct_api",
    periodMonth,
    rowCount: result.rowCount,
    costRub: result.costRub,
    importId: result.importId,
  }, { headers: { "Cache-Control": "no-store" } });
}
