import type { createSupabaseServer } from "@/lib/supabase";
import {
  deriveDeliveryMetrics,
  mapAcquisitionRpcPayload,
} from "@/lib/finance-acquisition";
import { classifyGeminiFamily } from "@/lib/finance-parse";
import {
  buildLiveCogs,
  buildLiveRevenue,
  cogsByProviderUsdFromCsvFamilies,
  cogsByProviderUsdFromPriced,
  type LiveRevenueRow,
} from "@/lib/finance-live";
import {
  buildFinanceDailySeries,
  buildFinanceModelDailySeries,
  clampFinanceDay,
  computeFinancePnl,
  estimateCreditLiabilityRub,
  moneyRub,
  moscowDayKey,
  moscowToday,
  overlappingMonthStarts,
  usdToRub,
} from "@/lib/finance-pnl";
import {
  GEMINI_FAMILY_LABELS,
  type FinanceAdsSource,
  type FinanceAdsVatMode,
  type FinanceImportKind,
  type FinanceImportMeta,
  type FinanceLiability,
  type FinanceMonthData,
  type GeminiFamilyId,
} from "@/lib/finance-types";
import { parseFinanceModelUnitCosts, type LiveCogsRow, type PricedCogsRow } from "@/lib/finance-unit-costs";

type SupabaseServer = ReturnType<typeof createSupabaseServer>;

type ImportRow = {
  id: string;
  kind: FinanceImportKind;
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

type AdsRow = {
  spend_date: string;
  campaign_id: string;
  campaign_name: string | null;
  ad_group_id: string | null;
  ad_id: string | null;
  criterion_id: string | null;
  impressions: number | string;
  clicks: number | string;
  cost_rub: number | string;
  currency: string | null;
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

function isMissingBackend(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  const code = error.code || "";
  const message = (error.message || "").toLowerCase();
  return (
    code === "42P01"
    || code === "42883"
    || code === "PGRST202"
    || code === "PGRST205"
    || message.includes("does not exist")
    || message.includes("could not find the function")
    || message.includes("could not find the table")
    || message.includes("schema cache")
  );
}

function parseAdsVatMode(value: unknown): FinanceAdsVatMode {
  return value === "included" || value === "excluded" ? value : "unknown";
}

export function adsSourceFromImport(row: {
  totals?: Record<string, unknown> | null;
  source_filename?: string;
}): FinanceAdsSource {
  const totals = row.totals || {};
  if (totals.source === "direct_api") return "direct_api";
  if (String(row.source_filename || "").startsWith("direct-api")) return "direct_api";
  return "csv";
}

export function pickFinanceSourceImports<T>(input: {
  csvOverride: boolean;
  revenue: T | null;
  cogs: T | null;
  ads: T | null;
  adsSource: FinanceAdsSource | null;
}): { revenue: T | null; cogs: T | null; ads: T | null } {
  if (input.csvOverride) {
    return { revenue: input.revenue, cogs: input.cogs, ads: input.ads };
  }
  return {
    revenue: null,
    cogs: null,
    ads: input.adsSource === "direct_api" ? input.ads : null,
  };
}

function cogsProviderUsd(
  cogs: FinanceMonthData["cogs"],
  livePriced: PricedCogsRow[],
) {
  if (!cogs) return undefined;
  if (cogs.source === "estimate") return cogsByProviderUsdFromPriced(livePriced);
  return cogsByProviderUsdFromCsvFamilies(cogs.byFamily);
}

function monthDateRange(periodMonth: string): { from: string; to: string } {
  const prefix = periodMonth.slice(0, 7);
  const [year, month] = prefix.split("-").map(Number);
  const last = new Date(year, month, 0).getDate();
  return { from: `${prefix}-01`, to: `${prefix}-${String(last).padStart(2, "0")}` };
}

function adsBreakdownMetrics(input: {
  campaignId: string;
  campaignName: string;
  adId?: string | null;
  costRub: number;
  clicks: number;
  impressions: number;
}) {
  const derived = deriveDeliveryMetrics({
    day: "1970-01-01",
    spendRub: input.costRub,
    clicks: input.clicks,
    impressions: input.impressions,
  });
  return {
    campaignId: input.campaignId,
    campaignName: input.campaignName,
    adId: input.adId,
    costRub: derived.spendRub,
    clicks: derived.clicks,
    impressions: derived.impressions,
    ctr: derived.ctr,
    cpc: derived.cpc,
  };
}

export async function fetchFinanceMonth(
  supabase: SupabaseServer,
  periodMonth: string,
  options: { csvOverride?: boolean } = {},
): Promise<FinanceMonthData> {
  const csvOverride = options.csvOverride === true;
  const { data: imports, error: importError } = await supabase
    .from("admin_finance_imports")
    .select(
      "id,kind,period_month,source_filename,file_sha256,uploaded_by_email,row_count,totals,usd_rub_rate,created_at,updated_at",
    )
    .eq("period_month", periodMonth);
  if (importError) throw new Error(importError.message);

  const rows = (imports || []) as ImportRow[];
  const revenueRow = rows.find((row) => row.kind === "revenue") || null;
  const cogsRow = rows.find((row) => row.kind === "cogs") || null;
  const adsRow = rows.find((row) => row.kind === "ads") || null;
  const picked = pickFinanceSourceImports({
    csvOverride,
    revenue: revenueRow,
    cogs: cogsRow,
    ads: adsRow,
    adsSource: adsRow ? adsSourceFromImport(adsRow) : null,
  });
  const revenueImport = picked.revenue;
  const cogsImport = picked.cogs;
  const adsImport = picked.ads;

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
      source: "csv",
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
      source: "csv",
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

  let ads: FinanceMonthData["ads"] = null;
  if (adsImport) {
    const { data, error } = await supabase
      .from("admin_finance_ads_lines")
      .select("spend_date,campaign_id,campaign_name,ad_group_id,ad_id,criterion_id,impressions,clicks,cost_rub,currency")
      .eq("import_id", adsImport.id);
    if (error && !isMissingBackend(error)) throw new Error(error.message);
    if (!error) {
      const lines = (data || []) as AdsRow[];
      const dailyMap = new Map<string, { day: string; costRub: number; clicks: number; impressions: number }>();
      const campaignMap = new Map<string, { campaignId: string; campaignName: string; costRub: number; clicks: number; impressions: number }>();
      const adMap = new Map<string, { campaignId: string; campaignName: string; adId: string; costRub: number; clicks: number; impressions: number }>();
      let costRub = 0;
      let clicks = 0;
      let impressions = 0;
      for (const line of lines) {
        const lineCost = money(line.cost_rub);
        const lineClicks = Number(line.clicks || 0);
        const lineImpressions = Number(line.impressions || 0);
        costRub += lineCost;
        clicks += lineClicks;
        impressions += lineImpressions;
        const day = String(line.spend_date).slice(0, 10);
        const daily = dailyMap.get(day) || { day, costRub: 0, clicks: 0, impressions: 0 };
        daily.costRub += lineCost;
        daily.clicks += lineClicks;
        daily.impressions += lineImpressions;
        dailyMap.set(day, daily);
        const campaignId = line.campaign_id || "unknown";
        const campaign = campaignMap.get(campaignId) || {
          campaignId,
          campaignName: line.campaign_name || campaignId,
          costRub: 0,
          clicks: 0,
          impressions: 0,
        };
        campaign.costRub += lineCost;
        campaign.clicks += lineClicks;
        campaign.impressions += lineImpressions;
        if (!campaign.campaignName && line.campaign_name) campaign.campaignName = line.campaign_name;
        campaignMap.set(campaignId, campaign);
        if (line.ad_id) {
          const adKey = `${campaignId}|${line.ad_id}`;
          const ad = adMap.get(adKey) || {
            campaignId,
            campaignName: line.campaign_name || campaignId,
            adId: line.ad_id,
            costRub: 0,
            clicks: 0,
            impressions: 0,
          };
          ad.costRub += lineCost;
          ad.clicks += lineClicks;
          ad.impressions += lineImpressions;
          adMap.set(adKey, ad);
        }
      }
      const totals = adsImport.totals || {};
      const kpi = deriveDeliveryMetrics({
        day: periodMonth.slice(0, 10),
        spendRub: costRub,
        clicks,
        impressions,
      });
      ads = {
        import: toMeta(adsImport),
        source: adsSourceFromImport(adsImport),
        kpi: {
          costRub: kpi.spendRub,
          clicks: kpi.clicks,
          impressions: kpi.impressions,
          count: lines.length,
          currency: "RUB",
          vatMode: parseAdsVatMode(totals.vatMode),
          droppedOutsideMonth: Number(totals.droppedOutsideMonth || 0),
          ctr: kpi.ctr,
          cpc: kpi.cpc,
        },
        daily: [...dailyMap.values()]
          .map((row) => deriveDeliveryMetrics({
            day: row.day,
            spendRub: row.costRub,
            clicks: row.clicks,
            impressions: row.impressions,
          }))
          .map((row) => ({
            day: row.day,
            costRub: row.spendRub,
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr,
            cpc: row.cpc,
          }))
          .sort((left, right) => left.day.localeCompare(right.day)),
        byCampaign: [...campaignMap.values()]
          .map(adsBreakdownMetrics)
          .sort((left, right) => right.costRub - left.costRub),
        byAd: [...adMap.values()]
          .map(adsBreakdownMetrics)
          .sort((left, right) => right.costRub - left.costRub)
          .slice(0, 30),
      };
    }
  }

  if (!revenue) {
    const { data, error } = await supabase.rpc("admin_finance_live_revenue_month", {
      p_month: periodMonth,
    });
    if (error && !isMissingBackend(error)) throw new Error(error.message);
    if (!error) {
      revenue = buildLiveRevenue((data || []) as LiveRevenueRow[]);
    }
  }

  let livePriced: ReturnType<typeof buildLiveCogs>["priced"] = [];
  if (!cogs) {
    const [{ data: cogsRows, error: cogsError }, { data: costRows, error: costError }] = await Promise.all([
      supabase.rpc("admin_finance_live_cogs_month", { p_month: periodMonth }),
      supabase.from("landing_generation_config").select("value").eq("key", "finance_model_unit_costs").maybeSingle(),
    ]);
    if (cogsError && !isMissingBackend(cogsError)) throw new Error(cogsError.message);
    if (costError && !isMissingBackend(costError)) throw new Error(costError.message);
    if (!cogsError) {
      const built = buildLiveCogs(
        (cogsRows || []) as LiveCogsRow[],
        parseFinanceModelUnitCosts(costRows?.value),
      );
      livePriced = built.priced;
      const { priced: _priced, ...cogsView } = built;
      cogs = cogsView;
    }
  }

  const { data: liabilityRows } = await supabase.rpc("admin_credit_liability_summary");
  const liabilityRow = (liabilityRows || [])[0] as {
    credits_total?: number;
  } | undefined;
  const creditsTotal = Number(liabilityRow?.credits_total || 0);
  const liability: FinanceLiability = {
    creditsTotal,
    liabilityRubEstimate: estimateCreditLiabilityRub(creditsTotal),
  };

  const range = monthDateRange(periodMonth);
  let acquisition: FinanceMonthData["acquisition"] = null;
  const { data: cohortRaw, error: cohortError } = await supabase.rpc("admin_acquisition_cohort", {
    p_from: range.from,
    p_to: range.to,
  });
  if (cohortError && !isMissingBackend(cohortError)) {
    console.error("[admin.finance] acquisition_cohort_failed", {
      periodMonth,
      message: cohortError.message,
    });
  }
  const mapped = !cohortError && cohortRaw != null
    ? mapAcquisitionRpcPayload(cohortRaw)
    : { delivery: [], cohorts: [], quality: null };
  const localDelivery = (ads?.daily || []).map((row) => deriveDeliveryMetrics({
    day: row.day,
    spendRub: row.costRub,
    clicks: row.clicks,
    impressions: row.impressions,
  }));
  const deliveryByDay = new Map(localDelivery.map((row) => [row.day, row]));
  for (const row of mapped.delivery) {
    const current = deliveryByDay.get(row.day);
    deliveryByDay.set(row.day, current
      ? {
        ...current,
        payments: row.payments ?? current.payments,
        revenueRub: row.revenueRub ?? current.revenueRub,
      }
      : row);
  }
  const delivery = [...deliveryByDay.values()].sort((left, right) => left.day.localeCompare(right.day));
  if (delivery.length || mapped.cohorts.length || mapped.quality) {
    acquisition = {
      delivery,
      cohorts: mapped.cohorts,
      quality: mapped.quality,
    };
  }

  const today = moscowToday();
  const from = range.from;
  const to = range.to > today ? today : range.to;

  return {
    month: periodMonth,
    from,
    to,
    csvOverride,
    csvAvailable: {
      revenue: revenueRow ? toMeta(revenueRow) : null,
      cogs: cogsRow ? toMeta(cogsRow) : null,
      ads: adsRow ? toMeta(adsRow) : null,
    },
    revenue,
    cogs,
    ads,
    acquisition,
    daily: buildFinanceDailySeries({
      from,
      to,
      revenueDaily: revenue?.daily,
      cogsDaily: cogs?.daily,
      dailyByFamily: cogs?.dailyByFamily,
    }),
    modelDaily: buildFinanceModelDailySeries({
      from,
      to,
      dailyByFamily: cogs?.dailyByFamily,
    }),
    liability,
    pnl: computeFinancePnl({
      gross: revenue?.kpi.gross,
      commission: revenue?.kpi.commission,
      vat: revenue?.kpi.vat,
      spendUsd: cogs?.kpi.subtotalUsd,
      adsCabinetRub: ads?.kpi.costRub,
      cogsByProviderUsd: cogsProviderUsd(cogs, livePriced),
      revenueSource: revenue?.source ?? null,
      cogsSource: cogs?.source ?? null,
      adsSource: ads?.source ?? null,
    }),
  };
}

function inDayRange(day: string, from: string, to: string): boolean {
  return day >= from && day <= to;
}

function firstSource<T>(values: Array<T | null | undefined>): T | null {
  return values.find((value): value is T => value != null) ?? null;
}

export function mergeFinancePeriod(
  parts: FinanceMonthData[],
  range: { from: string; to: string },
): FinanceMonthData {
  const { from, to } = range;
  const month = `${to.slice(0, 7)}-01`;
  const revenueDaily = parts.flatMap((part) => (part.revenue?.daily || []).filter((row) => inDayRange(row.day, from, to)));
  const cogsDaily = parts.flatMap((part) => (part.cogs?.daily || []).filter((row) => inDayRange(row.day, from, to)));
  const dailyByFamily = parts.flatMap((part) => (part.cogs?.dailyByFamily || []).filter((row) => inDayRange(row.day, from, to)));
  const adsDaily = parts.flatMap((part) => (part.ads?.daily || []).filter((row) => inDayRange(row.day, from, to)));

  const revenueGross = money(revenueDaily.reduce((sum, row) => sum + row.gross, 0));
  const revenueNet = money(revenueDaily.reduce((sum, row) => sum + row.net, 0));
  const revenueFees = money(revenueDaily.reduce((sum, row) => sum + row.fees, 0));
  const revenueCount = revenueDaily.reduce((sum, row) => sum + row.count, 0);
  const hasRevenue = parts.some((part) => part.revenue);
  const revenue: FinanceMonthData["revenue"] = hasRevenue
    ? {
      import: firstSource(parts.map((part) => part.revenue?.import ?? null)),
      source: firstSource(parts.map((part) => part.revenue?.source)) || "live_ledger",
      kpi: {
        gross: revenueGross,
        net: revenueNet,
        commission: revenueFees,
        vat: 0,
        count: revenueCount,
        currency: firstSource(parts.map((part) => part.revenue?.kpi.currency)) || "RUB",
      },
      daily: revenueDaily.sort((left, right) => left.day.localeCompare(right.day)),
      byType: [{ paymentType: "period", gross: revenueGross, net: revenueNet, count: revenueCount }],
    }
    : null;

  const cogsUsd = usd(cogsDaily.reduce((sum, row) => sum + row.subtotalUsd, 0));
  const hasCogs = parts.some((part) => part.cogs);
  const familyMap = new Map<GeminiFamilyId, number>();
  for (const row of dailyByFamily) {
    familyMap.set(row.family, (familyMap.get(row.family) || 0) + row.subtotalUsd);
  }
  const cogs: FinanceMonthData["cogs"] = hasCogs
    ? {
      import: firstSource(parts.map((part) => part.cogs?.import ?? null)),
      source: firstSource(parts.map((part) => part.cogs?.source)) || "estimate",
      kpi: {
        subtotalUsd: cogsUsd,
        subtotalRub: usdToRub(cogsUsd),
        count: parts.reduce((sum, part) => sum + (part.cogs?.kpi.count || 0), 0),
      },
      daily: [...cogsDaily].sort((left, right) => left.day.localeCompare(right.day)),
      dailyByFamily: [...dailyByFamily].sort((left, right) => left.day.localeCompare(right.day) || left.family.localeCompare(right.family)),
      byFamily: [...familyMap.entries()].map(([family, value]) => {
        const subtotalUsd = usd(value);
        return { family, label: GEMINI_FAMILY_LABELS[family], subtotalUsd, subtotalRub: usdToRub(subtotalUsd) };
      }).sort((left, right) => right.subtotalUsd - left.subtotalUsd),
      bySku: parts.flatMap((part) => part.cogs?.bySku || []),
    }
    : null;

  const adsCost = money(adsDaily.reduce((sum, row) => sum + row.costRub, 0));
  const adsClicks = adsDaily.reduce((sum, row) => sum + row.clicks, 0);
  const adsImpressions = adsDaily.reduce((sum, row) => sum + row.impressions, 0);
  const adsDerived = deriveDeliveryMetrics({
    day: from,
    spendRub: adsCost,
    clicks: adsClicks,
    impressions: adsImpressions,
  });
  const hasAds = parts.some((part) => part.ads);
  const ads: FinanceMonthData["ads"] = hasAds
    ? {
      import: firstSource(parts.map((part) => part.ads?.import ?? null)),
      source: firstSource(parts.map((part) => part.ads?.source)) || "direct_api",
      kpi: {
        costRub: adsDerived.spendRub,
        clicks: adsDerived.clicks,
        impressions: adsDerived.impressions,
        count: adsDaily.length,
        currency: "RUB",
        vatMode: firstSource(parts.map((part) => part.ads?.kpi.vatMode)) || "unknown",
        droppedOutsideMonth: 0,
        ctr: adsDerived.ctr,
        cpc: adsDerived.cpc,
      },
      daily: [...adsDaily].sort((left, right) => left.day.localeCompare(right.day)),
      byCampaign: parts.flatMap((part) => part.ads?.byCampaign || []),
      byAd: parts.flatMap((part) => part.ads?.byAd || []),
    }
    : null;

  const delivery = parts
    .flatMap((part) => part.acquisition?.delivery || [])
    .filter((row) => inDayRange(row.day, from, to))
    .sort((left, right) => left.day.localeCompare(right.day));
  const cohorts = parts.flatMap((part) => part.acquisition?.cohorts || []);
  const quality = firstSource(parts.map((part) => part.acquisition?.quality ?? null));

  return {
    month,
    from,
    to,
    csvOverride: parts.some((part) => part.csvOverride),
    csvAvailable: {
      revenue: firstSource(parts.map((part) => part.csvAvailable.revenue)),
      cogs: firstSource(parts.map((part) => part.csvAvailable.cogs)),
      ads: firstSource(parts.map((part) => part.csvAvailable.ads)),
    },
    revenue,
    cogs,
    ads,
    acquisition: delivery.length || cohorts.length || quality
      ? { delivery, cohorts, quality }
      : null,
    daily: buildFinanceDailySeries({
      from,
      to,
      revenueDaily,
      cogsDaily,
      dailyByFamily,
    }),
    modelDaily: buildFinanceModelDailySeries({
      from,
      to,
      dailyByFamily,
    }),
    liability: parts[0]?.liability || { creditsTotal: 0, liabilityRubEstimate: 0 },
    pnl: computeFinancePnl({
      gross: hasRevenue ? revenueGross : null,
      commission: hasRevenue ? revenueFees : null,
      vat: hasRevenue ? 0 : null,
      spendUsd: hasCogs ? cogsUsd : null,
      adsCabinetRub: hasAds ? adsCost : null,
      cogsByProviderUsd: cogs
        ? cogsByProviderUsdFromCsvFamilies(cogs.byFamily)
        : undefined,
      revenueSource: revenue?.source ?? null,
      cogsSource: cogs?.source ?? null,
      adsSource: ads?.source ?? null,
    }),
  };
}

export async function fetchFinancePeriod(
  supabase: SupabaseServer,
  range: { from: string; to: string },
  options: { csvOverride?: boolean } = {},
): Promise<FinanceMonthData> {
  const months = overlappingMonthStarts(range.from, range.to);
  const parts = await Promise.all(
    months.map((periodMonth) => fetchFinanceMonth(supabase, periodMonth, options)),
  );
  return mergeFinancePeriod(parts, range);
}
