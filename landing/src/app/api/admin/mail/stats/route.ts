import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAdmin } from "@/lib/analytics-admin";
import { loadMailAdminDailyStats, resolveMailAdminStatsQuery } from "@/lib/mail-admin-stats";
import { createSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const gate = await requireAnalyticsAdmin(request);
  const resolved = resolveMailAdminStatsQuery({
    admin: gate.ok
      ? { ok: true }
      : { ok: false, status: gate.status, error: gate.error },
    daysParam: request.nextUrl.searchParams.get("days"),
  });
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  try {
    const supabase = createSupabaseServer();
    const payload = await loadMailAdminDailyStats({
      days: resolved.days,
      rpc: (fn, args) => supabase.rpc(fn, args),
    });
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[admin.mail.stats] fetch_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "mail_stats_fetch_failed" }, { status: 502 });
  }
}
