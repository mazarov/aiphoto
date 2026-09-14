import assert from "node:assert/strict";
import test from "node:test";
import { npsRate, npsRowTrigger, parseNpsAnalyticsDays } from "./nps-analytics-data";

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

test("npsRowTrigger prefers survey_trigger over reserved trigger", () => {
  assert.equal(npsRowTrigger({ survey_trigger: "credits_empty", trigger: "after_2" }), "credits_empty");
  assert.equal(npsRowTrigger({ trigger: "after_2" }), "after_2");
  assert.equal(npsRowTrigger({}), "");
});
