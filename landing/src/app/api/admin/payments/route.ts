import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAdmin } from "@/lib/analytics-admin";
import {
  ADMIN_PAYMENT_CSV_MAX_ROWS,
  ADMIN_PAYMENT_CSV_PAGE_SIZE,
  encodeAdminPaymentCursor,
  parseAdminPaymentCursor,
  parseAdminPaymentAttributionFilter,
  parseAdminPaymentFormat,
  parseAdminPaymentLimit,
  parseAdminPaymentStatus,
  parseAdminPaymentTestFilter,
  paymentTestFilterToRpc,
  serializeAdminPaymentsCsv,
  toAdminPaymentItem,
  type AdminPaymentItem,
  type AdminPaymentRow,
  type AdminPaymentStatus,
  type AdminPaymentTestFilter,
} from "@/lib/admin-payments";
import { createSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type PaymentPage = {
  items: AdminPaymentItem[];
  hasMore: boolean;
  nextCursor: string | null;
};

async function loadPaymentPage(input: {
  status: AdminPaymentStatus;
  testFilter: AdminPaymentTestFilter;
  source: string | null;
  campaign: string | null;
  cursor: { createdAt: string; id: string } | null;
  limit: number;
}): Promise<{ page: PaymentPage } | { error: string }> {
  const supabase = createSupabaseServer();
  const { data, error } = await supabase.rpc("admin_landing_payments", {
    p_status: input.status,
    p_test: paymentTestFilterToRpc(input.testFilter),
    p_source: input.source,
    p_campaign: input.campaign,
    p_cursor_created_at: input.cursor?.createdAt || null,
    p_cursor_id: input.cursor?.id || null,
    p_limit: input.limit,
  });
  if (error) return { error: error.message };

  const rows = (data || []) as AdminPaymentRow[];
  const hasMore = rows.length > input.limit;
  const page = rows.slice(0, input.limit);
  const items = page.map((row) => toAdminPaymentItem(row));
  const last = page.at(-1);
  return {
    page: {
      items,
      hasMore,
      nextCursor: hasMore && last
        ? encodeAdminPaymentCursor(last.created_at, last.id)
        : null,
    },
  };
}

export async function GET(req: NextRequest) {
  const gate = await requireAnalyticsAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const status = parseAdminPaymentStatus(req.nextUrl.searchParams.get("status"));
  const testFilter = parseAdminPaymentTestFilter(req.nextUrl.searchParams.get("test"));
  const format = parseAdminPaymentFormat(req.nextUrl.searchParams.get("format"));
  const source = parseAdminPaymentAttributionFilter(req.nextUrl.searchParams.get("source"));
  const campaign = parseAdminPaymentAttributionFilter(req.nextUrl.searchParams.get("campaign"));
  if (!status || !testFilter || !format) {
    return NextResponse.json({ error: "invalid_filter" }, { status: 400 });
  }

  if (format === "csv") {
    const items: AdminPaymentItem[] = [];
    let encodedCursor: string | null = null;
    let truncated = false;
    while (items.length < ADMIN_PAYMENT_CSV_MAX_ROWS) {
      const remaining = ADMIN_PAYMENT_CSV_MAX_ROWS - items.length;
      const loaded = await loadPaymentPage({
        status,
        testFilter,
        source,
        campaign,
        cursor: parseAdminPaymentCursor(encodedCursor),
        limit: Math.min(ADMIN_PAYMENT_CSV_PAGE_SIZE, remaining),
      });
      if ("error" in loaded) {
        console.error("[admin.payments] csv_fetch_failed", {
          adminEmail: gate.email,
          status,
          testFilter,
          source,
          campaign,
          message: loaded.error,
        });
        return NextResponse.json({ error: "payments_fetch_failed" }, { status: 500 });
      }
      items.push(...loaded.page.items);
      if (!loaded.page.nextCursor) break;
      if (items.length >= ADMIN_PAYMENT_CSV_MAX_ROWS) {
        truncated = loaded.page.hasMore;
        break;
      }
      encodedCursor = loaded.page.nextCursor;
    }

    console.info("[admin.payments] csv_export", {
      adminEmail: gate.email,
      status,
      testFilter,
      source,
      campaign,
      count: items.length,
      truncated,
    });

    const filename = `promptshot-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(Buffer.from(serializeAdminPaymentsCsv(items), "utf8"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Export-Count": String(items.length),
        "X-Export-Truncated": truncated ? "1" : "0",
      },
    });
  }

  const cursor = parseAdminPaymentCursor(req.nextUrl.searchParams.get("cursor"));
  const limit = parseAdminPaymentLimit(req.nextUrl.searchParams.get("limit"));
  const loaded = await loadPaymentPage({
    status,
    testFilter,
    source,
    campaign,
    cursor,
    limit,
  });
  if ("error" in loaded) {
    console.error("[admin.payments] fetch_failed", {
      adminEmail: gate.email,
      status,
      testFilter,
      source,
      campaign,
      message: loaded.error,
    });
    return NextResponse.json({ error: "payments_fetch_failed" }, { status: 500 });
  }

  return NextResponse.json({
    items: loaded.page.items,
    hasMore: loaded.page.hasMore,
    nextCursor: loaded.page.nextCursor,
  }, { headers: { "Cache-Control": "no-store" } });
}
