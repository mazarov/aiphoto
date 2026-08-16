import assert from "node:assert/strict";
import test from "node:test";
import { isAnalyzeQuotaCurrentWindow } from "./analyze-quota";

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

test("previous UTC day is not the current window", () => {
  assert.equal(
    isAnalyzeQuotaCurrentWindow(
      "2026-08-15T00:00:00+00:00",
      "2026-08-16T00:00:00.000Z",
    ),
    false,
  );
});
