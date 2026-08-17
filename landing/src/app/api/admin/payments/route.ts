import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAdmin } from "@/lib/analytics-admin";
import {
  encodeAdminPaymentCursor,
  parseAdminPaymentCursor,
  parseAdminPaymentLimit,
  parseAdminPaymentStatus,
  parseAdminPaymentTestFilter,
  paymentTestFilterToRpc,
  resolvePaymentCreditState,
  type AdminPaymentRow,
} from "@/lib/admin-payments";
import { createSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireAnalyticsAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const status = parseAdminPaymentStatus(req.nextUrl.searchParams.get("status"));
  const testFilter = parseAdminPaymentTestFilter(req.nextUrl.searchParams.get("test"));
  if (!status || !testFilter) {
    return NextResponse.json({ error: "invalid_filter" }, { status: 400 });
  }

  const cursor = parseAdminPaymentCursor(req.nextUrl.searchParams.get("cursor"));
  const limit = parseAdminPaymentLimit(req.nextUrl.searchParams.get("limit"));
  const supabase = createSupabaseServer();
  const { data, error } = await supabase.rpc("admin_landing_payments", {
    p_status: status,
    p_test: paymentTestFilterToRpc(testFilter),
    p_cursor_created_at: cursor?.createdAt || null,
    p_cursor_id: cursor?.id || null,
    p_limit: limit,
  });
  if (error) {
    console.error("[admin.payments] fetch_failed", {
      adminEmail: gate.email,
      status,
      testFilter,
      message: error.message,
    });
    return NextResponse.json({ error: "payments_fetch_failed" }, { status: 500 });
  }

  const rows = (data || []) as AdminPaymentRow[];
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const items = page.map((row) => ({
    id: row.id,
    provider: row.provider,
    providerPaymentId: row.provider_payment_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    authUserId: row.auth_user_id,
    landingUserId: row.landing_user_id,
    identityMismatch: row.auth_user_id !== row.landing_user_id,
    payerEmail: row.payer_email,
    payerDisplayName: row.payer_display_name,
    payerProvider: row.payer_provider,
    planId: row.plan_id,
    amountRub: Number(row.amount_rub),
    credits: row.credits,
    status: row.status,
    providerStatus: row.provider_status,
    test: row.test,
    creditedAt: row.credited_at,
    creditState: resolvePaymentCreditState(row),
  }));
  const last = page.at(-1);

  return NextResponse.json({
    items,
    hasMore,
    nextCursor: hasMore && last
      ? encodeAdminPaymentCursor(last.created_at, last.id)
      : null,
  }, { headers: { "Cache-Control": "no-store" } });
}
