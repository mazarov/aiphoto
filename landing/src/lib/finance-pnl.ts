import {
  FINANCE_REVENUE_TAX_RATE,
  FINANCE_USD_RUB_RATE,
  type FinancePnl,
} from "./finance-types";

export function moneyRub(value: number | string | null | undefined): number {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

export function usdToRub(usd: number): number {
  return moneyRub(usd * FINANCE_USD_RUB_RATE);
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
