import { NextRequest, NextResponse } from "next/server";
import { financeSyncMonth, syncDirectAdsMonth } from "@/lib/finance-direct-sync";
import { createSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization")?.trim() ?? "";
  return header === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const periodMonth = financeSyncMonth(request.nextUrl.searchParams.get("month"));
  if (!periodMonth) {
    return NextResponse.json({ error: "invalid_filter" }, { status: 400 });
  }

  const result = await syncDirectAdsMonth({
    supabase: createSupabaseServer(),
    periodMonth,
    uploadedByEmail: "cron@promptshot",
  });
  if (!result.ok) {
    if (result.error === "missing_direct_token") {
      return NextResponse.json(
        { ok: true, ads: "missing_token", periodMonth },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error("[cron.finance] direct_sync_failed", {
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
  }, { headers: { "Cache-Control": "no-store" } });
}
