import assert from "node:assert/strict";
import test from "node:test";
import {
  isAnalyzeQuotaCurrentWindow,
  SCOUT_ANALYZE_BUCKET,
  SCOUT_ANALYZE_FREE_PER_DAY,
} from "./analyze-quota";

test("current UTC window matches Postgres +00:00 and JS .000Z", () => {
  const windowStart = "2026-08-16T00:00:00.000Z";
  assert.equal(
    isAnalyzeQuotaCurrentWindow("2026-08-16T00:00:00+00:00", windowStart),
    true,
  );
  assert.equal(isAnalyzeQuotaCurrentWindow(windowStart, windowStart), true);
  assert.equal(
    String("2026-08-16T00:00:00+00:00") < windowStart,
    true,
    "string compare is the production bug: +00:00 looks older than .000Z",
  );
});

test("scout analyze quota is a dedicated 100/day bucket", () => {
  assert.equal(SCOUT_ANALYZE_BUCKET, "scout:v1");
  assert.equal(SCOUT_ANALYZE_FREE_PER_DAY, 100);
});

test("previous UTC day is not the current window", () => {
  assert.equal(
    isAnalyzeQuotaCurrentWindow(
      "2026-08-15T00:00:00+00:00",
      "2026-08-16T00:00:00.000Z",
    ),
    false,
  );
});
