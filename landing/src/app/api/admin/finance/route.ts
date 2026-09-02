import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAdmin } from "@/lib/analytics-admin";
import { fetchFinanceMonth, fetchFinancePeriod } from "@/lib/finance-data";
import {
  FINANCE_RANGE_MAX_DAYS,
  parseFinanceCsvOverride,
  parseFinanceDateRange,
  parseFinancePeriod,
} from "@/lib/finance-parse";
import { listFinanceRangeDays } from "@/lib/finance-pnl";
import { createSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireAnalyticsAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const csvOverride = parseFinanceCsvOverride(req.nextUrl.searchParams.get("csv"));
  const range = parseFinanceDateRange(
    req.nextUrl.searchParams.get("from"),
    req.nextUrl.searchParams.get("to"),
  );
  const periodMonth = parseFinancePeriod(req.nextUrl.searchParams.get("month"));
  if (range && listFinanceRangeDays(range.from, range.to).length > FINANCE_RANGE_MAX_DAYS) {
    return NextResponse.json({ error: "invalid_filter" }, { status: 400 });
  }
  if (!range && !periodMonth) {
    return NextResponse.json({ error: "invalid_filter" }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServer();
    const data = range
      ? await fetchFinancePeriod(supabase, range, { csvOverride })
      : await fetchFinanceMonth(supabase, periodMonth as string, { csvOverride });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[admin.finance] fetch_failed", {
      adminEmail: gate.email,
      range,
      periodMonth,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "finance_fetch_failed" }, { status: 500 });
  }
}
