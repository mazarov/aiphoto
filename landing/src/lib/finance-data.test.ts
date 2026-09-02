import assert from "node:assert/strict";
import test from "node:test";
import { adsSourceFromImport, pickFinanceSourceImports } from "./finance-data";

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
