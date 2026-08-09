import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAdmin } from "@/lib/analytics-admin";
import { fetchAnalyticsDashboard } from "@/lib/analytics-data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireAnalyticsAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const raw = Number(req.nextUrl.searchParams.get("days") || 30);
  const days = Number.isFinite(raw) ? Math.min(90, Math.max(1, Math.floor(raw))) : 30;
  try {
    return NextResponse.json(await fetchAnalyticsDashboard(days), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[admin.analytics] fetch_failed", {
      adminEmail: gate.email, message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "analytics_fetch_failed" }, { status: 500 });
  }
}
