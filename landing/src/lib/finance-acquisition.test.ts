import assert from "node:assert/strict";
import test from "node:test";
import {
  campaignIdForSpendJoin,
  cohortWindowMaturity,
  computeCac,
  computeCacMax,
  computeContributionLtv,
  computeContributionMarginRate,
  computeCpaAha,
  computeCtr,
  computeCpc,
  computeGrossRoas,
  computeGrossRomi,
  computeLtv,
  deriveAcquisitionMetrics,
  isLiveAcquisitionPayment,
  isRevenueInWindow,
  mapAcquisitionRpcPayload,
  revenueWindowDay,
  sumLiveGrossRevenue,
  buildAcquisitionQuality,
} from "./finance-acquisition";
import { computeFinancePnl } from "./finance-pnl";

test("CAC CPA ROAS LTV use spend and first payers", () => {
  assert.equal(computeCac(10_000, 4), 2_500);
  assert.equal(computeCpaAha(10_000, 20), 500);
  assert.equal(computeGrossRoas(15_000, 10_000), 1.5);
  assert.equal(computeGrossRomi(15_000, 10_000), 0.5);
  assert.equal(computeLtv(15_000, 4), 3_750);
  assert.equal(computeCtr(25, 1_000), 0.025);
  assert.equal(computeCpc(1_000, 25), 40);
});

test("contribution LTV and CAC max use bounded margin and safety factor", () => {
  const margin = computeContributionMarginRate({
    grossRub: 27_278,
    netIncomeRub: 14_023.8,
  });
  assert.equal(margin, 14_023.8 / 27_278);
  const contributionLtv = computeContributionLtv(229.23, margin);
  assert.equal(contributionLtv, 117.85);
  assert.equal(computeCacMax(contributionLtv, 0.7), 82.49);
  assert.equal(
    computeContributionMarginRate({ grossRub: 0, netIncomeRub: 0 }),
    null,
  );
  assert.equal(computeCacMax(100, 1.1), null);
});

test("zero denominators stay null instead of zero or infinity", () => {
  assert.equal(computeCac(1_000, 0), null);
  assert.equal(computeCpaAha(1_000, 0), null);
  assert.equal(computeGrossRoas(500, 0), null);
  assert.equal(computeGrossRomi(500, 0), null);
  assert.equal(computeLtv(500, 0), null);
  assert.equal(computeCtr(10, 0), null);
  assert.equal(computeCpc(10, 0), null);
  assert.equal(computeCac(0, 0), null);
});

test("live revenue includes both providers and excludes test Stars pending", () => {
  const payments = [
    { provider: "yookassa", status: "succeeded", creditedAt: "2026-08-01T10:00:00+03:00", test: false, amountRub: 299 },
    { provider: "robokassa", status: "succeeded", creditedAt: "2026-08-02T10:00:00+03:00", test: false, amountRub: 469 },
    { provider: "yookassa", status: "succeeded", creditedAt: "2026-08-03T10:00:00+03:00", test: true, amountRub: 99 },
    { provider: "stars", status: "succeeded", creditedAt: "2026-08-03T10:00:00+03:00", test: false, amountRub: 150 },
    { provider: "yookassa", status: "pending", creditedAt: null, test: false, amountRub: 990 },
    { provider: "robokassa", status: "succeeded", creditedAt: null, test: false, amountRub: 299 },
  ];
  assert.equal(payments.filter(isLiveAcquisitionPayment).length, 2);
  assert.equal(sumLiveGrossRevenue(payments), 768);
  assert.equal(isLiveAcquisitionPayment(payments[2]), false);
  assert.equal(isLiveAcquisitionPayment(payments[3]), false);
});

test("Moscow day around UTC boundary is not treated as UTC analytics", () => {
  assert.equal(revenueWindowDay("2026-08-15", "2026-08-15T22:00:00.000Z"), 1);
  assert.equal(revenueWindowDay("2026-08-16", "2026-08-15T22:00:00.000Z"), 0);
  assert.equal(isRevenueInWindow("2026-08-15", "2026-08-15T22:00:00.000Z", 0), false);
  assert.equal(isRevenueInWindow("2026-08-15", "2026-08-15T20:59:59.000Z", 0), true);
  assert.equal(isRevenueInWindow("2026-08-15", "2026-08-15T21:00:00.000Z", 0), false);
});

test("D7 and D30 stay immature until the window closes", () => {
  assert.deepEqual(cohortWindowMaturity("2026-08-01", "2026-08-01"), {
    d0: true,
    d7: false,
    d30: false,
  });
  assert.deepEqual(cohortWindowMaturity("2026-08-01", "2026-08-07"), {
    d0: true,
    d7: false,
    d30: false,
  });
  assert.deepEqual(cohortWindowMaturity("2026-08-01", "2026-08-08"), {
    d0: true,
    d7: true,
    d30: false,
  });
  assert.deepEqual(cohortWindowMaturity("2026-08-01", "2026-08-31"), {
    d0: true,
    d7: true,
    d30: true,
  });
});

test("yclid alone does not become a campaign join key", () => {
  assert.equal(campaignIdForSpendJoin({ utmCampaign: "12345678", yclid: "999" }), "12345678");
  assert.equal(campaignIdForSpendJoin({ utmCampaign: "brand", yclid: "999" }), null);
  assert.equal(campaignIdForSpendJoin({ utmCampaign: null, yclid: "999" }), null);
  assert.equal(campaignIdForSpendJoin({ yclid: "12345678" }), null);
});

test("ads spend is not subtracted from the old netIncomeRub", () => {
  const pnl = computeFinancePnl({
    gross: 100_000,
    commission: 3_000,
    vat: 600,
    spendUsd: 10,
  });
  assert.equal(pnl.spendRub, 900);
  assert.equal(pnl.netIncomeRub, 89_500);
  const adsSpendRub = 12_000;
  assert.notEqual(pnl.netIncomeRub, moneySafe(pnl.netIncomeRub) - adsSpendRub);
});

test("derived cohort metrics stay null on immature zero-spend rows", () => {
  const row = deriveAcquisitionMetrics({
    cohortDate: "2026-08-10",
    visitors: 20,
    ahaVisitors: 4,
    signupUsers: 2,
    firstPayers: 0,
    spendRub: 0,
    impressions: 0,
    clicks: 0,
    revenueD0: 0,
    revenueD7: 0,
    revenueD30: 0,
    asOf: "2026-08-12",
  });
  assert.equal(row.activationRate, 0.2);
  assert.equal(row.cac, null);
  assert.equal(row.grossRoasD7, null);
  assert.equal(row.ltvD30, null);
  assert.equal(row.maturity.d7, false);
});

test("RPC payload mapper derives formulas from admin_acquisition_cohort rows", () => {
  const mapped = mapAcquisitionRpcPayload({
    delivery: [{ day: "2026-08-01", spend_rub: 1000, clicks: 10, impressions: 200, payments: 1, gross_revenue_rub: 299 }],
    cohorts: [{
      cohort_date: "2026-08-01",
      source: "ya",
      campaign_id: "100",
      visitors: 20,
      aha_visitors: 4,
      first_payers: 2,
      spend_rub: 1000,
      revenue_d7: 1500,
    }],
    data_quality: { direct_visits: 10, direct_visits_with_yclid: 8 },
  }, "2026-08-10");
  assert.equal(mapped.delivery[0].cpc, 100);
  assert.equal(mapped.delivery[0].revenueRub, 299);
  assert.equal(mapped.cohorts[0].source, "yandex");
  assert.equal(mapped.cohorts[0].cac, 500);
  assert.equal(mapped.cohorts[0].grossRoasD7, 1.5);
  assert.equal(mapped.cohorts[0].maturity.d7, true);
  assert.equal(mapped.quality?.directVisitsWithYclidRate, 0.8);
});

test("RPC payload mapper prefers campaign economics over path rows", () => {
  const mapped = mapAcquisitionRpcPayload({
    cohorts: [{
      cohort_date: "2026-08-01",
      campaign_id: "100",
      landing_path: "/a",
      spend_rub: 1000,
      first_payers: 1,
    }],
    campaign_economics: [{
      cohort_date: "2026-08-01",
      campaign_id: "100",
      spend_rub: 1000,
      first_payers: 2,
    }],
  }, "2026-08-10");
  assert.equal(mapped.cohorts.length, 1);
  assert.equal(mapped.cohorts[0].landingPath, null);
  assert.equal(mapped.cohorts[0].cac, 500);
});

test("data quality rates use the same zero-denominator rule", () => {
  const quality = buildAcquisitionQuality({
    directVisits: 10,
    directVisitsWithYclid: 8,
    directVisitsWithNumericCampaign: 7,
    funnelFacts: 0,
    funnelFactsWithVisitor: 0,
    unmatchedSpendCampaigns: ["100", "200", "300"],
    timeToFirstAhaHours: 0.75,
  });
  assert.equal(quality.directVisitsWithYclidRate, 0.8);
  assert.equal(quality.directVisitsWithNumericCampaignRate, 0.7);
  assert.equal(quality.funnelFactsWithVisitorRate, null);
  assert.deepEqual(quality.unmatchedSpendCampaigns, ["100", "200", "300"]);
  assert.equal(quality.timeToFirstAhaHours, 0.75);
});

function moneySafe(value: number | null): number {
  return value == null ? 0 : value;
}
