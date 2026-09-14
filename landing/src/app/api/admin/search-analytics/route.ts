import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAdmin } from "@/lib/analytics-admin";
import {
  fetchSearchAnalyticsDashboard,
  parseSearchAnalyticsDays,
} from "@/lib/search-analytics-data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireAnalyticsAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const days = parseSearchAnalyticsDays(req.nextUrl.searchParams.get("days"));
  try {
    return NextResponse.json(await fetchSearchAnalyticsDashboard(days), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[admin.search-analytics] fetch_failed", {
      adminEmail: gate.email,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "search_analytics_fetch_failed" }, { status: 500 });
  }
}
