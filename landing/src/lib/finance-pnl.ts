import {
  FINANCE_REVENUE_TAX_RATE,
  FINANCE_RUB_PER_CREDIT,
  FINANCE_USD_RUB_RATE,
  type FinanceDailyPoint,
  type FinanceModelDailyPoint,
  type FinancePnl,
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

export function computeFinancePnl(input: {
  gross?: number | null;
  commission?: number | null;
  vat?: number | null;
  spendUsd?: number | null;
}): FinancePnl {
  const hasRevenue = input.gross != null;
  const hasCogs = input.spendUsd != null;
  const spendUsd = hasCogs ? Number(input.spendUsd) : null;
  const spendRub = spendUsd != null && Number.isFinite(spendUsd) ? usdToRub(spendUsd) : null;
  const grossRub = hasRevenue ? moneyRub(input.gross) : null;
  const yookassaFeesRub = hasRevenue
    ? moneyRub(moneyRub(input.commission) + moneyRub(input.vat))
    : null;
  const taxRub = grossRub != null ? moneyRub(grossRub * FINANCE_REVENUE_TAX_RATE) : null;
  const netIncomeRub =
    grossRub != null
      ? moneyRub(grossRub - (yookassaFeesRub || 0) - (taxRub || 0) - (spendRub || 0))
      : null;

  return {
    usdRubRate: FINANCE_USD_RUB_RATE,
    taxRate: FINANCE_REVENUE_TAX_RATE,
    grossRub,
    yookassaFeesRub,
    taxRub,
    spendUsd: spendUsd != null && Number.isFinite(spendUsd) ? spendUsd : null,
    spendRub,
    netIncomeRub,
    missingCogs: hasRevenue && !hasCogs,
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

export function buildFinanceDailySeries(input: {
  periodMonth: string;
  revenueDaily?: { day: string; gross: number; fees?: number; net?: number }[];
  cogsDaily?: { day: string; subtotalRub: number }[];
  now?: Date;
}): FinanceDailyPoint[] {
  const prefix = input.periodMonth.slice(0, 7);
  const revenueByDay = new Map(
    (input.revenueDaily || [])
      .filter((row) => row.day.startsWith(prefix))
      .map((row) => [row.day, row]),
  );
  const cogsByDay = new Map(
    (input.cogsDaily || [])
      .filter((row) => row.day.startsWith(prefix))
      .map((row) => [row.day, row.subtotalRub]),
  );
  const days = new Set(listFinanceMonthDays(input.periodMonth, input.now));
  for (const day of [...revenueByDay.keys(), ...cogsByDay.keys()]) days.add(day);

  return [...days].sort().map((day) => {
    const revenue = revenueByDay.get(day);
    const revenueRub = moneyRub(revenue?.gross);
    const feesRub = moneyRub(
      revenue?.fees != null
        ? revenue.fees
        : Math.max(0, moneyRub(revenue?.gross) - moneyRub(revenue?.net)),
    );
    const taxRub = moneyRub(revenueRub * FINANCE_REVENUE_TAX_RATE);
    const geminiRub = moneyRub(cogsByDay.get(day));
    const costRub = moneyRub(feesRub + taxRub + geminiRub);
    return {
      day,
      revenueRub,
      costRub,
      profitRub: moneyRub(revenueRub - costRub),
    };
  });
}

export function buildFinanceModelDailySeries(input: {
  periodMonth: string;
  dailyByFamily?: { day: string; family: GeminiFamilyId; subtotalRub: number }[];
  now?: Date;
}): FinanceModelDailyPoint[] {
  const prefix = input.periodMonth.slice(0, 7);
  const byDay = new Map<string, Partial<Record<GeminiFamilyId, number>>>();
  for (const row of input.dailyByFamily || []) {
    if (!row.day.startsWith(prefix)) continue;
    const current = byDay.get(row.day) || {};
    current[row.family] = moneyRub((current[row.family] || 0) + row.subtotalRub);
    byDay.set(row.day, current);
  }
  const days = new Set(listFinanceMonthDays(input.periodMonth, input.now));
  for (const day of byDay.keys()) days.add(day);
  return [...days].sort().map((day) => {
    const byFamily = byDay.get(day) || {};
    const totalRub = moneyRub(Object.values(byFamily).reduce((sum, value) => sum + (value || 0), 0));
    return { day, totalRub, byFamily };
  });
}
