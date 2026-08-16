import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFinanceDailySeries,
  buildFinanceModelDailySeries,
  clampFinanceDay,
  computeFinancePnl,
  estimateCreditLiabilityRub,
  listFinanceMonthDays,
  moscowDayKey,
  usdToRub,
} from "./finance-pnl";

test("credit liability uses 5 credits = 2.5 RUB", () => {
  assert.equal(estimateCreditLiabilityRub(5), 2.5);
  assert.equal(estimateCreditLiabilityRub(3605), 1802.5);
  assert.equal(estimateCreditLiabilityRub(0), 0);
});

test("Gemini spend uses static 90 RUB per USD", () => {
  assert.equal(usdToRub(10), 900);
  assert.equal(usdToRub(7.82), 703.8);
});

test("net income subtracts YooKassa fees, 6% tax on gross, and Gemini", () => {
  const pnl = computeFinancePnl({
    gross: 100_000,
    commission: 3_000,
    vat: 600,
    spendUsd: 10,
  });
  assert.equal(pnl.usdRubRate, 90);
  assert.equal(pnl.taxRate, 0.06);
  assert.equal(pnl.grossRub, 100_000);
  assert.equal(pnl.yookassaFeesRub, 3_600);
  assert.equal(pnl.taxRub, 6_000);
  assert.equal(pnl.spendRub, 900);
  assert.equal(pnl.netIncomeRub, 89_500);
  assert.equal(pnl.missingCogs, false);
});

test("net income without Gemini import treats spend as 0 and flags missing cogs", () => {
  const pnl = computeFinancePnl({
    gross: 10_000,
    commission: 100,
    vat: 20,
  });
  assert.equal(pnl.spendRub, null);
  assert.equal(pnl.missingCogs, true);
  assert.equal(pnl.netIncomeRub, 9_280);
});

test("Gemini-only month has spend but no net income", () => {
  const pnl = computeFinancePnl({ spendUsd: 2 });
  assert.equal(pnl.spendRub, 180);
  assert.equal(pnl.netIncomeRub, null);
  assert.equal(pnl.missingCogs, false);
});

test("moscow day key keeps YooKassa dates on the Moscow calendar", () => {
  assert.equal(moscowDayKey("2026-08-16T01:00:00+03:00"), "2026-08-16");
  assert.equal(moscowDayKey("2026-08-15T22:00:00.000Z"), "2026-08-16");
  assert.equal(moscowDayKey(null), "unknown");
  assert.equal(clampFinanceDay("2026-07-31", "2026-08-01"), "2026-08-01");
  assert.equal(clampFinanceDay("unknown", "2026-08-01"), "2026-08-31");
});

test("finance month days stop at today for the current month", () => {
  const days = listFinanceMonthDays("2026-08-01", new Date(2026, 7, 16));
  assert.equal(days[0], "2026-08-01");
  assert.equal(days.at(-1), "2026-08-16");
  assert.equal(days.length, 16);
});

test("daily series tracks revenue, all-in costs, and profit", () => {
  const series = buildFinanceDailySeries({
    periodMonth: "2026-08-01",
    now: new Date(2026, 7, 3),
    revenueDaily: [{ day: "2026-08-01", gross: 10_000, fees: 360 }],
    cogsDaily: [{ day: "2026-08-02", subtotalRub: 900 }],
  });
  assert.deepEqual(series, [
    { day: "2026-08-01", revenueRub: 10_000, costRub: 960, profitRub: 9_040 },
    { day: "2026-08-02", revenueRub: 0, costRub: 900, profitRub: -900 },
    { day: "2026-08-03", revenueRub: 0, costRub: 0, profitRub: 0 },
  ]);
});

test("model daily series splits Gemini families across days", () => {
  const series = buildFinanceModelDailySeries({
    periodMonth: "2026-08-01",
    now: new Date(2026, 7, 2),
    dailyByFamily: [
      { day: "2026-08-01", family: "gemini-3-pro-image", subtotalRub: 450 },
      { day: "2026-08-01", family: "gemini-2.5-flash-image", subtotalRub: 90 },
      { day: "2026-08-02", family: "gemini-3-pro-image", subtotalRub: 180 },
    ],
  });
  assert.equal(series.length, 2);
  assert.equal(series[0].totalRub, 540);
  assert.equal(series[0].byFamily["gemini-3-pro-image"], 450);
  assert.equal(series[1].totalRub, 180);
});
