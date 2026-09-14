import assert from "node:assert/strict";
import test from "node:test";
import { npsRate, parseNpsAnalyticsDays } from "./nps-analytics-data";

test("parseNpsAnalyticsDays allows only dashboard periods", () => {
  assert.equal(parseNpsAnalyticsDays("7"), 7);
  assert.equal(parseNpsAnalyticsDays("90"), 90);
  assert.equal(parseNpsAnalyticsDays("14"), 30);
  assert.equal(parseNpsAnalyticsDays(null), 30);
});

test("npsRate is zero without a denominator", () => {
  assert.equal(npsRate(3, 10), 0.3);
  assert.equal(npsRate(1, 0), 0);
});
