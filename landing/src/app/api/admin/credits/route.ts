import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAdmin } from "@/lib/analytics-admin";
import {
  encodeAdminCreditCursor,
  parseAdminCreditCursor,
  parseAdminCreditLimit,
  type AdminCreditLiabilityRow,
  type AdminCreditLiabilitySummary,
} from "@/lib/admin-credits";
import { createSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function numberOrNull(value: unknown): number | null {
  if (value == null) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export async function GET(req: NextRequest) {
  const gate = await requireAnalyticsAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const cursor = parseAdminCreditCursor(req.nextUrl.searchParams.get("cursor"));
  if (req.nextUrl.searchParams.get("cursor") && !cursor) {
    return NextResponse.json({ error: "invalid_filter" }, { status: 400 });
  }
  const limit = parseAdminCreditLimit(req.nextUrl.searchParams.get("limit"));
  const supabase = createSupabaseServer();

  const [summaryResult, listResult] = await Promise.all([
    supabase.rpc("admin_credit_liability_summary"),
    supabase.rpc("admin_credit_liabilities", {
      p_cursor_credits: cursor?.credits ?? null,
      p_cursor_id: cursor?.id ?? null,
      p_limit: limit,
    }),
  ]);

  if (summaryResult.error || listResult.error) {
    console.error("[admin.credits] fetch_failed", {
      adminEmail: gate.email,
      summary: summaryResult.error?.message,
      list: listResult.error?.message,
    });
    return NextResponse.json({ error: "credits_fetch_failed" }, { status: 500 });
  }

  const summaryRow = (summaryResult.data || [])[0] as AdminCreditLiabilitySummary | undefined;
  const rows = (listResult.data || []) as AdminCreditLiabilityRow[];
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page.at(-1);

  return NextResponse.json({
    summary: {
      usersWithCredits: Number(summaryRow?.users_with_credits || 0),
      creditsTotal: Number(summaryRow?.credits_total || 0),
      blendedRubPerCredit: numberOrNull(summaryRow?.blended_rub_per_credit),
      liabilityRubEstimate: numberOrNull(summaryRow?.liability_rub_estimate),
    },
    items: page.map((row) => ({
      landingUserId: row.landing_user_id,
      email: row.email,
      displayName: row.display_name,
      provider: row.provider,
      credits: Number(row.credits || 0),
      updatedAt: row.updated_at,
    })),
    hasMore,
    nextCursor: hasMore && last
      ? encodeAdminCreditCursor(Number(last.credits || 0), last.landing_user_id)
      : null,
  }, { headers: { "Cache-Control": "no-store" } });
}
