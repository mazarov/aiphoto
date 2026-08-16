import assert from "node:assert/strict";
import test from "node:test";
import { computeFinancePnl, usdToRub } from "./finance-pnl";

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
