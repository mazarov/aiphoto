import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAdmin } from "@/lib/analytics-admin";
import {
  FINANCE_MAX_FILE_BYTES,
  FinanceParseError,
  parseFinanceKind,
  parseFinancePeriod,
  parseFinanceUpload,
  parseUsdRubRate,
} from "@/lib/finance-parse";
import { createSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function errorStatus(code: string): number {
  if (code === "file_too_large" || code === "too_many_rows") return 413;
  return 400;
}

export async function POST(req: NextRequest) {
  const gate = await requireAnalyticsAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const kind = parseFinanceKind(String(form.get("kind") || ""));
  const periodMonth = parseFinancePeriod(String(form.get("period") || ""));
  const rate = parseUsdRubRate(form.get("usdRubRate") == null ? null : String(form.get("usdRubRate")));
  const file = form.get("file");
  if (!kind || !periodMonth || rate === undefined) {
    return NextResponse.json({ error: "invalid_filter" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }
  if (file.size > FINANCE_MAX_FILE_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const filename = file.name || (kind === "revenue" ? "yookassa.csv" : "gcp-billing.csv");
  let parsed;
  try {
    parsed = parseFinanceUpload(kind, filename, bytes);
  } catch (error) {
    if (error instanceof FinanceParseError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: errorStatus(error.code) },
      );
    }
    throw error;
  }

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const supabase = createSupabaseServer();
  const { data, error } = await supabase.rpc("admin_finance_replace_import", {
    p_kind: kind,
    p_period_month: periodMonth,
    p_source_filename: filename.slice(0, 240),
    p_file_sha256: sha256,
    p_uploaded_by_email: gate.email,
    p_row_count: parsed.totals.count,
    p_totals: parsed.totals,
    p_usd_rub_rate: rate,
    p_revenue_lines: parsed.kind === "revenue" ? parsed.lines : null,
    p_cogs_lines: parsed.kind === "cogs" ? parsed.lines : null,
  });
  if (error) {
    console.error("[admin.finance] import_failed", {
      adminEmail: gate.email,
      kind,
      periodMonth,
      sha256,
      rowCount: parsed.totals.count,
      message: error.message,
    });
    return NextResponse.json({ error: "finance_import_failed" }, { status: 500 });
  }

  console.info("[admin.finance] imported", {
    adminEmail: gate.email,
    kind,
    periodMonth,
    sha256,
    rowCount: parsed.totals.count,
    importId: data,
  });

  return NextResponse.json({
    ok: true,
    importId: data,
    kind,
    periodMonth,
    rowCount: parsed.totals.count,
    totals: parsed.totals,
  }, { headers: { "Cache-Control": "no-store" } });
}
