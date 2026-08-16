import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAdmin } from "@/lib/analytics-admin";
import {
  encodeAdminCreditCursor,
  parseAdminCreditCursor,
  parseAdminCreditDays,
  parseAdminCreditLimit,
  parseAdminCreditSearch,
  reconstructCreditRemaining,
  type AdminCreditFlowRow,
  type AdminCreditLiabilityRow,
  type AdminCreditLiabilitySummary,
} from "@/lib/admin-credits";
import { estimateCreditLiabilityRub } from "@/lib/finance-pnl";
import { FINANCE_RUB_PER_CREDIT } from "@/lib/finance-types";
import { createSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireAnalyticsAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const cursor = parseAdminCreditCursor(req.nextUrl.searchParams.get("cursor"));
  if (req.nextUrl.searchParams.get("cursor") && !cursor) {
    return NextResponse.json({ error: "invalid_filter" }, { status: 400 });
  }
  const limit = parseAdminCreditLimit(req.nextUrl.searchParams.get("limit"));
  const days = parseAdminCreditDays(req.nextUrl.searchParams.get("days"));
  const search = parseAdminCreditSearch(req.nextUrl.searchParams.get("q"));
  const supabase = createSupabaseServer();

  const [summaryResult, listResult, flowResult] = await Promise.all([
    supabase.rpc("admin_credit_liability_summary"),
    supabase.rpc("admin_credit_liabilities", {
      p_cursor_credits: cursor?.credits ?? null,
      p_cursor_id: cursor?.id ?? null,
      p_limit: limit,
      p_search: search,
    }),
    supabase.rpc("admin_credit_daily_flow", { p_days: days }),
  ]);

  if (summaryResult.error || listResult.error || flowResult.error) {
    console.error("[admin.credits] fetch_failed", {
      adminEmail: gate.email,
      summary: summaryResult.error?.message,
      list: listResult.error?.message,
      flow: flowResult.error?.message,
    });
    return NextResponse.json({ error: "credits_fetch_failed" }, { status: 500 });
  }

  const summaryRow = (summaryResult.data || [])[0] as AdminCreditLiabilitySummary | undefined;
  const rows = (listResult.data || []) as AdminCreditLiabilityRow[];
  const flow = ((flowResult.data || []) as AdminCreditFlowRow[]).map((row) => ({
    day: String(row.day).slice(0, 10),
    granted: Number(row.granted || 0),
    spent: Number(row.spent || 0),
    refunded: Number(row.refunded || 0),
  }));
  const creditsTotal = Number(summaryRow?.credits_total || 0);
  const series = reconstructCreditRemaining(creditsTotal, flow);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page.at(-1);

  return NextResponse.json({
    summary: {
      usersWithCredits: Number(summaryRow?.users_with_credits || 0),
      creditsTotal,
      blendedRubPerCredit: FINANCE_RUB_PER_CREDIT,
      liabilityRubEstimate: estimateCreditLiabilityRub(creditsTotal),
    },
    flow: {
      days,
      granted: series.reduce((sum, row) => sum + row.granted, 0),
      spent: series.reduce((sum, row) => sum + row.spent, 0),
      refunded: series.reduce((sum, row) => sum + row.refunded, 0),
      series,
    },
    items: page.map((row) => ({
      landingUserId: row.landing_user_id,
      email: row.email,
      displayName: row.display_name,
      provider: row.provider,
      remaining: Number(row.credits || 0),
      grantedTotal: Number(row.granted_total || 0),
      spentTotal: Number(row.spent_total || 0),
      sharePct: creditsTotal > 0
        ? Math.round((Number(row.credits || 0) / creditsTotal) * 1000) / 10
        : 0,
      updatedAt: row.updated_at,
    })),
    hasMore,
    nextCursor: hasMore && last
      ? encodeAdminCreditCursor(Number(last.credits || 0), last.landing_user_id)
      : null,
  }, { headers: { "Cache-Control": "no-store" } });
}
