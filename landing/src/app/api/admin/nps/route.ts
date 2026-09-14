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
    console.error("[admin.nps] fetch_failed", {
      adminEmail: gate.email,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "nps_fetch_failed" }, { status: 500 });
  }
}
