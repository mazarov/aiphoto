import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAdmin } from "@/lib/analytics-admin";
import { fetchFinanceMonth } from "@/lib/finance-data";
import { parseFinancePeriod } from "@/lib/finance-parse";
import { createSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireAnalyticsAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const periodMonth = parseFinancePeriod(req.nextUrl.searchParams.get("month"));
  if (!periodMonth) {
    return NextResponse.json({ error: "invalid_filter" }, { status: 400 });
  }

  try {
    const data = await fetchFinanceMonth(createSupabaseServer(), periodMonth);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[admin.finance] fetch_failed", {
      adminEmail: gate.email,
      periodMonth,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "finance_fetch_failed" }, { status: 500 });
  }
}
