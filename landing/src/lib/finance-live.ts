import {
  estimateYookassaFees,
  moneyRub,
  usdToRub,
} from "@/lib/finance-pnl";
import {
  GEMINI_FAMILY_LABELS,
  type FinanceCogsByProvider,
  type FinanceCogsSource,
  type FinanceMonthData,
  type FinanceRevenueSource,
  type GeminiFamilyId,
} from "@/lib/finance-types";
import {
  priceLiveCogsRows,
  type FinanceModelUnitCosts,
  type LiveCogsRow,
  type PricedCogsRow,
} from "@/lib/finance-unit-costs";

export type LiveRevenueRow = {
  day: string;
  payment_count: number;
  gross_rub: number;
};

function usd(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 1_000_000) / 1_000_000 : 0;
}

export function buildLiveRevenue(
  rows: LiveRevenueRow[],
): NonNullable<FinanceMonthData["revenue"]> {
  const daily = rows
    .map((row) => {
      const gross = moneyRub(row.gross_rub);
      const fees = estimateYookassaFees(gross);
      return {
        day: String(row.day).slice(0, 10),
        gross,
        net: fees.net,
        fees: fees.fees,
        count: Number(row.payment_count) || 0,
        commission: fees.commission,
        vat: fees.vat,
      };
    })
    .sort((left, right) => left.day.localeCompare(right.day));
  const gross = moneyRub(daily.reduce((sum, row) => sum + row.gross, 0));
  const commission = moneyRub(daily.reduce((sum, row) => sum + row.commission, 0));
  const vat = moneyRub(daily.reduce((sum, row) => sum + row.vat, 0));
  const net = moneyRub(daily.reduce((sum, row) => sum + row.net, 0));
  return {
    import: null,
    source: "live_ledger" satisfies FinanceRevenueSource,
    kpi: {
      gross,
      net,
      commission,
      vat,
      count: daily.reduce((sum, row) => sum + row.count, 0),
      currency: "RUB",
    },
    daily: daily.map(({ commission: _c, vat: _v, ...row }) => row),
    byType: [{ paymentType: "yookassa", gross, net, count: daily.reduce((sum, row) => sum + row.count, 0) }],
  };
}

export function buildLiveCogs(
  rows: LiveCogsRow[],
  costs: FinanceModelUnitCosts,
): NonNullable<FinanceMonthData["cogs"]> & { priced: PricedCogsRow[] } {
  const priced = priceLiveCogsRows(rows, costs);
  const dailyMap = new Map<string, number>();
  const dailyFamilyMap = new Map<string, { day: string; family: GeminiFamilyId; subtotalUsd: number }>();
  const familyMap = new Map<GeminiFamilyId, number>();
  const skuMap = new Map<string, { skuId: string; skuDescription: string; subtotalUsd: number; usageAmount: number }>();
  let subtotalUsd = 0;
  let billedUsd = 0;
  let estimatedUsd = 0;
  let jobs = 0;
  for (const row of priced) {
    subtotalUsd += row.subtotalUsd;
    billedUsd += row.billedUsd;
    estimatedUsd += row.estimatedUsd;
    jobs += row.jobs;
    dailyMap.set(row.day, (dailyMap.get(row.day) || 0) + row.subtotalUsd);
    familyMap.set(row.family, (familyMap.get(row.family) || 0) + row.subtotalUsd);
    const familyKey = `${row.day}|${row.family}`;
    const dailyFamily = dailyFamilyMap.get(familyKey) || { day: row.day, family: row.family, subtotalUsd: 0 };
    dailyFamily.subtotalUsd += row.subtotalUsd;
    dailyFamilyMap.set(familyKey, dailyFamily);
    const sku = skuMap.get(row.modelId) || {
      skuId: row.modelId,
      skuDescription: row.modelId,
      subtotalUsd: 0,
      usageAmount: 0,
    };
    sku.subtotalUsd += row.subtotalUsd;
    sku.usageAmount += row.jobs;
    skuMap.set(row.modelId, sku);
  }
  return {
    import: null,
    source: "estimate" satisfies FinanceCogsSource,
    priced,
    kpi: {
      subtotalUsd: usd(subtotalUsd),
      subtotalRub: usdToRub(usd(subtotalUsd)),
      count: jobs,
      billedUsd: usd(billedUsd),
      estimatedUsd: usd(estimatedUsd),
    },
    daily: [...dailyMap.entries()]
      .map(([day, value]) => {
        const subtotalUsd = usd(value);
        return { day, subtotalUsd, subtotalRub: usdToRub(subtotalUsd) };
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

export function cogsByProviderUsdFromPriced(rows: PricedCogsRow[]): FinanceCogsByProvider {
  const out: FinanceCogsByProvider = { google: 0, xai: 0, openrouter: 0, other: 0 };
  for (const row of rows) out[row.provider] += row.subtotalUsd;
  return out;
}

export function cogsByProviderUsdFromCsvFamilies(
  byFamily: { family: GeminiFamilyId; subtotalUsd: number }[],
): FinanceCogsByProvider {
  const out: FinanceCogsByProvider = { google: 0, xai: 0, openrouter: 0, other: 0 };
  for (const row of byFamily) {
    if (row.family.startsWith("grok-")) out.xai += row.subtotalUsd;
    else if (
      row.family === "seedream-image"
      || row.family === "flux-image"
      || row.family === "seedance-video"
    ) {
      out.openrouter += row.subtotalUsd;
    } else if (row.family === "other") {
      out.other += row.subtotalUsd;
    } else {
      out.google += row.subtotalUsd;
    }
  }
  return out;
}

