import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAdmin } from "@/lib/analytics-admin";
import { fetchNpsAnalyticsDashboard, parseNpsAnalyticsDays } from "@/lib/nps-analytics-data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireAnalyticsAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const days = parseNpsAnalyticsDays(req.nextUrl.searchParams.get("days"));
  try {
    return NextResponse.json(await fetchNpsAnalyticsDashboard(days), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const extra = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
    console.error("[admin.nps] fetch_failed", {
      adminEmail: gate.email,
      rpc: extra.rpc,
      code: extra.code,
      message: error instanceof Error ? error.message : String(error),
      details: extra.details,
      hint: extra.hint,
    });
    return NextResponse.json({ error: "nps_fetch_failed" }, { status: 500 });
  }
}
