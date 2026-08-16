import type { createSupabaseServer } from "@/lib/supabase";
import { classifyGeminiFamily } from "@/lib/finance-parse";
import {
  buildFinanceDailySeries,
  buildFinanceModelDailySeries,
  clampFinanceDay,
  computeFinancePnl,
  moneyRub,
  moscowDayKey,
  usdToRub,
} from "@/lib/finance-pnl";
import {
  GEMINI_FAMILY_LABELS,
  type FinanceImportMeta,
  type FinanceLiability,
  type FinanceMonthData,
  type GeminiFamilyId,
} from "@/lib/finance-types";

type SupabaseServer = ReturnType<typeof createSupabaseServer>;

type ImportRow = {
  id: string;
  kind: "revenue" | "cogs";
  period_month: string;
  source_filename: string;
  file_sha256: string;
  uploaded_by_email: string;
  row_count: number;
  totals: Record<string, unknown> | null;
  usd_rub_rate: number | string | null;
  created_at: string;
  updated_at: string;
};

type RevenueRow = {
  provider_payment_id: string;
  paid_at: string | null;
  amount_gross: number | string;
  amount_net: number | string;
  commission: number | string;
  vat_on_commission: number | string;
  currency: string | null;
  payment_type: string | null;
};

type CogsRow = {
  usage_date: string;
  sku_id: string;
  sku_description: string;
  usage_amount: number | string;
  subtotal_usd: number | string;
};

const money = moneyRub;

function usd(value: number | string | null | undefined): number {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.round(amount * 1_000_000) / 1_000_000 : 0;
}

function toMeta(row: ImportRow): FinanceImportMeta {
  const rate = row.usd_rub_rate == null ? null : Number(row.usd_rub_rate);
  return {
    id: row.id,
    kind: row.kind,
    periodMonth: String(row.period_month).slice(0, 10),
    sourceFilename: row.source_filename,
    fileSha256: row.file_sha256,
    uploadedByEmail: row.uploaded_by_email,
    rowCount: Number(row.row_count || 0),
    usdRubRate: rate != null && Number.isFinite(rate) ? rate : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function dayKey(iso: string | null, periodMonth: string): string {
  return clampFinanceDay(moscowDayKey(iso), periodMonth);
}

export async function fetchFinanceMonth(
  supabase: SupabaseServer,
  periodMonth: string,
): Promise<FinanceMonthData> {
  const { data: imports, error: importError } = await supabase
    .from("admin_finance_imports")
    .select(
      "id,kind,period_month,source_filename,file_sha256,uploaded_by_email,row_count,totals,usd_rub_rate,created_at,updated_at",
    )
    .eq("period_month", periodMonth);
  if (importError) throw new Error(importError.message);

  const rows = (imports || []) as ImportRow[];
  const revenueImport = rows.find((row) => row.kind === "revenue") || null;
  const cogsImport = rows.find((row) => row.kind === "cogs") || null;

  let revenue: FinanceMonthData["revenue"] = null;
  if (revenueImport) {
    const { data, error } = await supabase
      .from("admin_finance_revenue_lines")
      .select("provider_payment_id,paid_at,amount_gross,amount_net,commission,vat_on_commission,currency,payment_type")
      .eq("import_id", revenueImport.id);
    if (error) throw new Error(error.message);
    const lines = (data || []) as RevenueRow[];
    const dailyMap = new Map<string, { day: string; gross: number; net: number; fees: number; count: number }>();
    const typeMap = new Map<string, { paymentType: string; gross: number; net: number; count: number }>();
    let gross = 0;
    let net = 0;
    let commission = 0;
    let vat = 0;
    for (const line of lines) {
      const lineGross = money(line.amount_gross);
      const lineNet = money(line.amount_net);
      gross += lineGross;
      net += lineNet;
      commission += money(line.commission);
      vat += money(line.vat_on_commission);
      const day = dayKey(line.paid_at, periodMonth);
      const daily = dailyMap.get(day) || { day, gross: 0, net: 0, fees: 0, count: 0 };
      daily.gross += lineGross;
      daily.net += lineNet;
      daily.fees += money(line.commission) + money(line.vat_on_commission);
      daily.count += 1;
      dailyMap.set(day, daily);
      const paymentType = line.payment_type || "unknown";
      const typed = typeMap.get(paymentType) || { paymentType, gross: 0, net: 0, count: 0 };
      typed.gross += lineGross;
      typed.net += lineNet;
      typed.count += 1;
      typeMap.set(paymentType, typed);
    }
    revenue = {
      import: toMeta(revenueImport),
      kpi: {
        gross: money(gross),
        net: money(net),
        commission: money(commission),
        vat: money(vat),
        count: lines.length,
        currency: lines[0]?.currency || "RUB",
      },
      daily: [...dailyMap.values()]
        .map((row) => ({
          ...row,
          gross: money(row.gross),
          net: money(row.net),
          fees: money(row.fees),
        }))
        .sort((left, right) => left.day.localeCompare(right.day)),
      byType: [...typeMap.values()]
        .map((row) => ({ ...row, gross: money(row.gross), net: money(row.net) }))
        .sort((left, right) => right.net - left.net),
    };
  }

  let cogs: FinanceMonthData["cogs"] = null;
  if (cogsImport) {
    const { data, error } = await supabase
      .from("admin_finance_cogs_lines")
      .select("usage_date,sku_id,sku_description,usage_amount,subtotal_usd")
      .eq("import_id", cogsImport.id);
    if (error) throw new Error(error.message);
    const lines = (data || []) as CogsRow[];
    const dailyMap = new Map<string, { day: string; subtotalUsd: number }>();
    const dailyFamilyMap = new Map<string, { day: string; family: GeminiFamilyId; subtotalUsd: number }>();
    const familyMap = new Map<GeminiFamilyId, number>();
    const skuMap = new Map<string, { skuId: string; skuDescription: string; subtotalUsd: number; usageAmount: number }>();
    let subtotalUsd = 0;
    for (const line of lines) {
      const amount = usd(line.subtotal_usd);
      subtotalUsd += amount;
      const day = String(line.usage_date).slice(0, 10);
      const daily = dailyMap.get(day) || { day, subtotalUsd: 0 };
      daily.subtotalUsd += amount;
      dailyMap.set(day, daily);
      const family = classifyGeminiFamily(line.sku_description || "");
      familyMap.set(family, (familyMap.get(family) || 0) + amount);
      const familyKey = `${day}|${family}`;
      const dailyFamily = dailyFamilyMap.get(familyKey) || { day, family, subtotalUsd: 0 };
      dailyFamily.subtotalUsd += amount;
      dailyFamilyMap.set(familyKey, dailyFamily);
      const sku = skuMap.get(line.sku_id) || {
        skuId: line.sku_id,
        skuDescription: line.sku_description,
        subtotalUsd: 0,
        usageAmount: 0,
      };
      sku.subtotalUsd += amount;
      sku.usageAmount += Number(line.usage_amount || 0);
      skuMap.set(line.sku_id, sku);
    }
    cogs = {
      import: toMeta(cogsImport),
      kpi: {
        subtotalUsd: usd(subtotalUsd),
        subtotalRub: usdToRub(usd(subtotalUsd)),
        count: lines.length,
      },
      daily: [...dailyMap.values()]
        .map((row) => {
          const subtotalUsd = usd(row.subtotalUsd);
          return { ...row, subtotalUsd, subtotalRub: usdToRub(subtotalUsd) };
        })
        .sort((left, right) => left.day.localeCompare(right.day)),
      dailyByFamily: [...dailyFamilyMap.values()]
        .map((row) => {
          const subtotalUsd = usd(row.subtotalUsd);
          return { ...row, subtotalUsd, subtotalRub: usdToRub(subtotalUsd) };
        })
        .sort((left, right) => left.day.localeCompare(right.day) || left.family.localeCompare(right.family)),
      byFamily: [...familyMap.entries()]
        .map(([family, value]) => {
          const subtotalUsd = usd(value);
          return {
            family,
            label: GEMINI_FAMILY_LABELS[family],
            subtotalUsd,
            subtotalRub: usdToRub(subtotalUsd),
          };
        })
        .sort((left, right) => right.subtotalUsd - left.subtotalUsd),
      bySku: [...skuMap.values()]
        .map((row) => {
          const subtotalUsd = usd(row.subtotalUsd);
          return { ...row, subtotalUsd, subtotalRub: usdToRub(subtotalUsd) };
        })
        .sort((left, right) => right.subtotalUsd - left.subtotalUsd)
        .slice(0, 30),
    };
  }

  const { data: liabilityRows } = await supabase.rpc("admin_credit_liability_summary");
  const liabilityRow = (liabilityRows || [])[0] as {
    credits_total?: number;
    liability_rub_estimate?: number | null;
  } | undefined;
  const liabilityRub = liabilityRow?.liability_rub_estimate == null
    ? null
    : Number(liabilityRow.liability_rub_estimate);
  const liability: FinanceLiability = {
    creditsTotal: Number(liabilityRow?.credits_total || 0),
    liabilityRubEstimate: liabilityRub != null && Number.isFinite(liabilityRub) ? liabilityRub : null,
  };

  return {
    month: periodMonth,
    revenue,
    cogs,
    daily: buildFinanceDailySeries({
      periodMonth,
      revenueDaily: revenue?.daily,
      cogsDaily: cogs?.daily,
    }),
    modelDaily: buildFinanceModelDailySeries({
      periodMonth,
      dailyByFamily: cogs?.dailyByFamily,
    }),
    liability,
    pnl: computeFinancePnl({
      gross: revenue?.kpi.gross,
      commission: revenue?.kpi.commission,
      vat: revenue?.kpi.vat,
      spendUsd: cogs?.kpi.subtotalUsd,
    }),
  };
}
