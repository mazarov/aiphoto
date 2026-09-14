import assert from "node:assert/strict";
import test from "node:test";
import { parseSearchAnalyticsDays, rate } from "./search-analytics-data";

test("parseSearchAnalyticsDays allows only dashboard periods", () => {
  assert.equal(parseSearchAnalyticsDays("7"), 7);
  assert.equal(parseSearchAnalyticsDays("90"), 90);
  assert.equal(parseSearchAnalyticsDays("14"), 30);
  assert.equal(parseSearchAnalyticsDays(null), 30);
});

test("rate is zero without a denominator", () => {
  assert.equal(rate(3, 10), 0.3);
  assert.equal(rate(1, 0), 0);
});
