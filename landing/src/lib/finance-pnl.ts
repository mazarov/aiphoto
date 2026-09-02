import { cogsProviderFromFamily } from "./finance-unit-costs";
import {
  FINANCE_ADS_VAT_MULTIPLIER,
  FINANCE_REVENUE_TAX_RATE,
  FINANCE_RUB_PER_CREDIT,
  FINANCE_USD_RUB_RATE,
  FINANCE_YOOKASSA_FEE_RATE,
  FINANCE_YOOKASSA_FEE_VAT_RATE,
  type FinanceAdsSource,
  type FinanceCogsByProvider,
  type FinanceCogsProvider,
  type FinanceCogsSource,
  type FinanceDailyPoint,
  type FinanceModelDailyPoint,
  type FinancePnl,
  type FinanceRevenueSource,
  type GeminiFamilyId,
} from "./finance-types";

export function moneyRub(value: number | string | null | undefined): number {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

export function usdToRub(usd: number): number {
  return moneyRub(usd * FINANCE_USD_RUB_RATE);
}

export function estimateCreditLiabilityRub(credits: number): number {
  return moneyRub(Math.max(0, Number(credits) || 0) * FINANCE_RUB_PER_CREDIT);
}

export function emptyCogsByProvider(): FinanceCogsByProvider {
  return { google: 0, xai: 0, openrouter: 0, other: 0 };
}

export function estimateYookassaFees(grossRub: number): {
  commission: number;
  vat: number;
  fees: number;
  net: number;
} {
  const gross = moneyRub(grossRub);
  const commission = moneyRub(gross * FINANCE_YOOKASSA_FEE_RATE);
  const vat = moneyRub(commission * FINANCE_YOOKASSA_FEE_VAT_RATE);
  const fees = moneyRub(commission + vat);
  return { commission, vat, fees, net: moneyRub(gross - fees) };
}

export function adsWithVatRub(cabinetRub: number): number {
  return moneyRub(cabinetRub * FINANCE_ADS_VAT_MULTIPLIER);
}

export function computeFinancePnl(input: {
  gross?: number | null;
  commission?: number | null;
  vat?: number | null;
  spendUsd?: number | null;
  adsCabinetRub?: number | null;
  cogsByProviderUsd?: Partial<Record<FinanceCogsProvider, number>>;
  revenueSource?: FinanceRevenueSource | null;
  cogsSource?: FinanceCogsSource | null;
  adsSource?: FinanceAdsSource | null;
}): FinancePnl {
  const hasRevenue = input.gross != null;
  const hasCogs = input.spendUsd != null;
  const hasAds = input.adsCabinetRub != null;
  const spendUsd = hasCogs ? Number(input.spendUsd) : null;
  const spendRub = spendUsd != null && Number.isFinite(spendUsd) ? usdToRub(spendUsd) : null;
  const grossRub = hasRevenue ? moneyRub(input.gross) : null;
  const yookassaFeesRub = hasRevenue
    ? moneyRub(moneyRub(input.commission) + moneyRub(input.vat))
    : null;
  const taxRub = grossRub != null ? moneyRub(grossRub * FINANCE_REVENUE_TAX_RATE) : null;
  const operatingRub =
    grossRub != null
      ? moneyRub(grossRub - (yookassaFeesRub || 0) - (taxRub || 0) - (spendRub || 0))
      : null;
  const adsCabinet = hasAds ? moneyRub(input.adsCabinetRub) : null;
  const adsWithVat = adsCabinet != null ? adsWithVatRub(adsCabinet) : null;
  const adsVat = adsCabinet != null && adsWithVat != null
    ? moneyRub(adsWithVat - adsCabinet)
    : null;
  const afterAdsRub =
    operatingRub != null
      ? moneyRub(operatingRub - (adsWithVat || 0))
      : null;
  const cogsByProviderRub = emptyCogsByProvider();
  for (const provider of Object.keys(cogsByProviderRub) as FinanceCogsProvider[]) {
    const usd = Number(input.cogsByProviderUsd?.[provider] || 0);
    cogsByProviderRub[provider] = usdToRub(usd);
  }

  return {
    usdRubRate: FINANCE_USD_RUB_RATE,
    taxRate: FINANCE_REVENUE_TAX_RATE,
    grossRub,
    yookassaFeesRub,
    taxRub,
    spendUsd: spendUsd != null && Number.isFinite(spendUsd) ? spendUsd : null,
    spendRub,
    cogsByProviderRub,
    operatingRub,
    adsCabinetRub: adsCabinet,
    adsWithVatRub: adsWithVat,
    adsVatRub: adsVat,
    afterAdsRub,
    netIncomeRub: operatingRub,
    missingCogs: hasRevenue && !hasCogs,
    missingAds: hasRevenue && !hasAds,
    revenueSource: input.revenueSource ?? null,
    cogsSource: input.cogsSource ?? null,
    adsSource: input.adsSource ?? null,
  };
}

export function moscowDayKey(iso: string | null | undefined): string {
  if (!iso) return "unknown";
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) {
    return /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : "unknown";
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(parsed));
}

export function clampFinanceDay(day: string, periodMonth: string): string {
  const prefix = periodMonth.slice(0, 7);
  if (/^\d{4}-\d{2}-\d{2}$/.test(day) && day.startsWith(prefix)) return day;
  const days = listFinanceMonthDays(periodMonth, new Date(2100, 0, 1));
  if (!days.length) return day;
  if (day < days[0]) return days[0];
  return days[days.length - 1];
}

export function listFinanceMonthDays(periodMonth: string, now = new Date()): string[] {
  const match = /^(\d{4})-(\d{2})/.exec(periodMonth);
  if (!match) return [];
  const year = Number(match[1]);
  const month = Number(match[2]);
  const last = new Date(year, month, 0).getDate();
  const isCurrent = now.getFullYear() === year && now.getMonth() + 1 === month;
  const end = isCurrent ? Math.min(last, now.getDate()) : last;
  const days: string[] = [];
  for (let day = 1; day <= end; day += 1) {
    days.push(`${match[1]}-${match[2]}-${String(day).padStart(2, "0")}`);
  }
  return days;
}

export function addCalendarDay(day: string, delta: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + delta)).toISOString().slice(0, 10);
}

export function moscowToday(now = new Date()): string {
  return moscowDayKey(now.toISOString());
}

export function listFinanceRangeDays(from: string, to: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    return [];
  }
  const days: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    days.push(cursor);
    cursor = addCalendarDay(cursor, 1);
  }
  return days;
}

export function overlappingMonthStarts(from: string, to: string): string[] {
  if (!from || !to || from > to) return [];
  const months: string[] = [];
  let cursor = `${from.slice(0, 7)}-01`;
  const last = `${to.slice(0, 7)}-01`;
  while (cursor <= last) {
    months.push(cursor);
    const [year, month] = cursor.split("-").map(Number);
    cursor = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  }
  return months;
}

export function financePresetRange(
  preset: "today" | "yesterday" | "d7",
  now = new Date(),
): { from: string; to: string } {
  const today = moscowToday(now);
  if (preset === "yesterday") {
    const day = addCalendarDay(today, -1);
    return { from: day, to: day };
  }
  if (preset === "d7") return { from: addCalendarDay(today, -6), to: today };
  return { from: today, to: today };
}

function dayInScope(day: string, input: { from?: string; to?: string; prefix?: string }): boolean {
  if (input.from && input.to) return day >= input.from && day <= input.to;
  if (input.prefix) return day.startsWith(input.prefix);
  return true;
}

export function buildFinanceDailySeries(input: {
  periodMonth?: string;
  from?: string;
  to?: string;
  revenueDaily?: { day: string; gross: number; fees?: number; net?: number }[];
  cogsDaily?: { day: string; subtotalRub: number }[];
  dailyByFamily?: { day: string; family: GeminiFamilyId; subtotalRub: number }[];
  now?: Date;
}): FinanceDailyPoint[] {
  const prefix = input.periodMonth?.slice(0, 7);
  const scope = { from: input.from, to: input.to, prefix };
  const revenueByDay = new Map(
    (input.revenueDaily || [])
      .filter((row) => dayInScope(row.day, scope))
      .map((row) => [row.day, row]),
  );
  const cogsByDay = new Map(
    (input.cogsDaily || [])
      .filter((row) => dayInScope(row.day, scope))
      .map((row) => [row.day, row.subtotalRub]),
  );
  const familyByDay = new Map<string, FinanceCogsByProvider>();
  for (const row of input.dailyByFamily || []) {
    if (!dayInScope(row.day, scope)) continue;
    const current = familyByDay.get(row.day) || emptyCogsByProvider();
    current[cogsProviderFromFamily(row.family)] = moneyRub(
      current[cogsProviderFromFamily(row.family)] + row.subtotalRub,
    );
    familyByDay.set(row.day, current);
  }
  const days = new Set(
    input.from && input.to
      ? listFinanceRangeDays(input.from, input.to)
      : input.periodMonth
        ? listFinanceMonthDays(input.periodMonth, input.now)
        : [],
  );
  for (const day of [...revenueByDay.keys(), ...cogsByDay.keys(), ...familyByDay.keys()]) {
    days.add(day);
  }

  return [...days].sort().map((day) => {
    const revenue = revenueByDay.get(day);
    const revenueRub = moneyRub(revenue?.gross);
    const yookassaFeesRub = moneyRub(
      revenue?.fees != null
        ? revenue.fees
        : Math.max(0, moneyRub(revenue?.gross) - moneyRub(revenue?.net)),
    );
    const taxRub = moneyRub(revenueRub * FINANCE_REVENUE_TAX_RATE);
    const cogsByProviderRub = familyByDay.get(day) || emptyCogsByProvider();
    const familyTotal = moneyRub(
      cogsByProviderRub.google + cogsByProviderRub.xai + cogsByProviderRub.openrouter + cogsByProviderRub.other,
    );
    const listedCogs = moneyRub(cogsByDay.get(day));
    if (listedCogs > familyTotal) {
      cogsByProviderRub.other = moneyRub(cogsByProviderRub.other + (listedCogs - familyTotal));
    }
    const aiRub = moneyRub(Math.max(listedCogs, familyTotal));
    const costRub = moneyRub(yookassaFeesRub + taxRub + aiRub);
    const operatingRub = moneyRub(revenueRub - costRub);
    return {
      day,
      revenueRub,
      yookassaFeesRub,
      taxRub,
      cogsByProviderRub,
      costRub,
      profitRub: operatingRub,
      operatingRub,
    };
  });
}

export function buildFinanceModelDailySeries(input: {
  periodMonth?: string;
  from?: string;
  to?: string;
  dailyByFamily?: { day: string; family: GeminiFamilyId; subtotalRub: number }[];
  now?: Date;
}): FinanceModelDailyPoint[] {
  const prefix = input.periodMonth?.slice(0, 7);
  const scope = { from: input.from, to: input.to, prefix };
  const byDay = new Map<string, Partial<Record<GeminiFamilyId, number>>>();
  for (const row of input.dailyByFamily || []) {
    if (!dayInScope(row.day, scope)) continue;
    const current = byDay.get(row.day) || {};
    current[row.family] = moneyRub((current[row.family] || 0) + row.subtotalRub);
    byDay.set(row.day, current);
  }
  const days = new Set(
    input.from && input.to
      ? listFinanceRangeDays(input.from, input.to)
      : input.periodMonth
        ? listFinanceMonthDays(input.periodMonth, input.now)
        : [],
  );
  for (const day of byDay.keys()) days.add(day);
  return [...days].sort().map((day) => {
    const byFamily = byDay.get(day) || {};
    const totalRub = moneyRub(Object.values(byFamily).reduce((sum, value) => sum + (value || 0), 0));
    return { day, totalRub, byFamily };
  });
}
