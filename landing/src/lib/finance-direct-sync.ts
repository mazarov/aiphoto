import { createHash } from "node:crypto";
import type { createSupabaseServer } from "@/lib/supabase";
import { parseFinancePeriod } from "@/lib/finance-parse";
import { moneyRub } from "@/lib/finance-pnl";
import { fetchDirectCampaignPerformance, getDirectToken } from "@/lib/yandex-direct-finance";

type SupabaseServer = ReturnType<typeof createSupabaseServer>;

function monthLastDay(periodMonth: string): string {
  const [year, month] = periodMonth.slice(0, 7).split("-").map(Number);
  const last = new Date(year, month, 0).getDate();
  return `${periodMonth.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

export function financeSyncMonth(raw?: string | null): string | null {
  if (!raw) {
    const now = new Date();
    return parseFinancePeriod(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  }
  return parseFinancePeriod(raw);
}

export async function syncDirectAdsMonth(input: {
  supabase: SupabaseServer;
  periodMonth: string;
  uploadedByEmail: string;
}): Promise<
  | { ok: true; rowCount: number; importId: unknown; costRub: number }
  | { ok: false; error: "missing_direct_token" | "direct_sync_failed"; message?: string }
> {
  if (!getDirectToken()) return { ok: false, error: "missing_direct_token" };
  const dateFrom = input.periodMonth.slice(0, 10);
  const dateTo = monthLastDay(input.periodMonth);
  let lines;
  try {
    lines = await fetchDirectCampaignPerformance({ dateFrom, dateTo });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "missing_direct_token") return { ok: false, error: "missing_direct_token" };
    return {
      ok: false,
      error: "direct_sync_failed",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  const costRub = moneyRub(lines.reduce((sum, line) => sum + line.cost_rub, 0));
  const clicks = lines.reduce((sum, line) => sum + line.clicks, 0);
  const impressions = lines.reduce((sum, line) => sum + line.impressions, 0);
  const payload = JSON.stringify(lines);
  const sha256 = createHash("sha256").update(payload).digest("hex");
  const { data, error } = await input.supabase.rpc("admin_finance_replace_import", {
    p_kind: "ads",
    p_period_month: input.periodMonth,
    p_source_filename: `direct-api-${dateFrom}-${dateTo}.tsv`,
    p_file_sha256: sha256,
    p_uploaded_by_email: input.uploadedByEmail.slice(0, 240),
    p_row_count: lines.length,
    p_totals: {
      costRub,
      clicks,
      impressions,
      count: lines.length,
      currency: "RUB",
      vatMode: "excluded",
      droppedOutsideMonth: 0,
      source: "direct_api",
    },
    p_usd_rub_rate: null,
    p_revenue_lines: null,
    p_cogs_lines: null,
    p_ads_lines: lines,
  });
  if (error) {
    return { ok: false, error: "direct_sync_failed", message: error.message };
  }
  return { ok: true, rowCount: lines.length, importId: data, costRub };
}
