import assert from "node:assert/strict";
import test from "node:test";
import { adsSourceFromImport, mergeFinancePeriod, pickFinanceSourceImports } from "./finance-data";
import type { FinanceMonthData } from "./finance-types";

const csvAds = { source_filename: "direct-august.csv", totals: {} };
const apiAds = { source_filename: "direct-api-2026-08-01-2026-08-31.tsv", totals: { source: "direct_api" } };

test("ads filename and totals mark Direct API vs uploaded CSV", () => {
  assert.equal(adsSourceFromImport(csvAds), "csv");
  assert.equal(adsSourceFromImport(apiAds), "direct_api");
});

test("CSV off keeps internal sources and drops uploaded overrides", () => {
  const off = pickFinanceSourceImports({
    csvOverride: false,
    revenue: { id: "rev" },
    cogs: { id: "cogs" },
    ads: csvAds,
    adsSource: "csv",
  });
  assert.equal(off.revenue, null);
  assert.equal(off.cogs, null);
  assert.equal(off.ads, null);

  const offApi = pickFinanceSourceImports({
    csvOverride: false,
    revenue: { id: "rev" },
    cogs: { id: "cogs" },
    ads: apiAds,
    adsSource: "direct_api",
  });
  assert.equal(offApi.revenue, null);
  assert.equal(offApi.cogs, null);
  assert.equal(offApi.ads, apiAds);
});

test("CSV on uses uploaded revenue, cogs, and ads", () => {
  const on = pickFinanceSourceImports({
    csvOverride: true,
    revenue: { id: "rev" },
    cogs: { id: "cogs" },
    ads: csvAds,
    adsSource: "csv",
  });
  assert.deepEqual(on, { revenue: { id: "rev" }, cogs: { id: "cogs" }, ads: csvAds });
});

test("mergeFinancePeriod keeps only days inside from/to", () => {
  const emptyPnl = {
    usdRubRate: 90,
    taxRate: 0.06,
    grossRub: 0,
    yookassaFeesRub: 0,
    taxRub: 0,
    spendUsd: 0,
    spendRub: 0,
    cogsByProviderRub: { google: 0, xai: 0, openrouter: 0, other: 0 },
    operatingRub: 0,
    adsCabinetRub: 0,
    adsWithVatRub: 0,
    adsVatRub: 0,
    afterAdsRub: 0,
    netIncomeRub: 0,
    missingCogs: false,
    missingAds: false,
    revenueSource: "live_ledger" as const,
    cogsSource: "estimate" as const,
    adsSource: null,
  };
  const part = {
    month: "2026-08-01",
    from: "2026-08-01",
    to: "2026-08-31",
    csvOverride: false,
    csvAvailable: { revenue: null, cogs: null, ads: null },
    revenue: {
      import: null,
      source: "live_ledger",
      kpi: { gross: 300, net: 280, commission: 20, vat: 0, count: 2, currency: "RUB" },
      daily: [
        { day: "2026-08-31", gross: 100, net: 90, fees: 10, count: 1 },
        { day: "2026-09-01", gross: 200, net: 190, fees: 10, count: 1 },
      ],
      byType: [],
    },
    cogs: {
      import: null,
      source: "estimate",
      kpi: { subtotalUsd: 2, subtotalRub: 180, count: 2 },
      daily: [
        { day: "2026-08-31", subtotalUsd: 1, subtotalRub: 90 },
        { day: "2026-09-01", subtotalUsd: 1, subtotalRub: 90 },
      ],
      dailyByFamily: [
        { day: "2026-09-01", family: "gemini-3.1-flash-image", subtotalUsd: 1, subtotalRub: 90 },
      ],
      byFamily: [],
      bySku: [],
    },
    ads: null,
    acquisition: null,
    daily: [],
    modelDaily: [],
    liability: { creditsTotal: 0, liabilityRubEstimate: 0 },
    pnl: emptyPnl,
  } as FinanceMonthData;

  const merged = mergeFinancePeriod([part], { from: "2026-09-01", to: "2026-09-01" });
  assert.equal(merged.revenue?.kpi.gross, 200);
  assert.equal(merged.revenue?.daily.length, 1);
  assert.equal(merged.cogs?.daily.length, 1);
  assert.equal(merged.daily.length, 1);
  assert.equal(merged.daily[0].cogsByProviderRub.google, 90);
});
