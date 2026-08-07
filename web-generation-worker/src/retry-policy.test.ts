import assert from "node:assert/strict";
import test from "node:test";
import { retryDelaySeconds, shouldRetry } from "./retry-policy";

test("retry only while attempts remain", () => {
  assert.equal(shouldRetry(true, 1, 3), true);
  assert.equal(shouldRetry(true, 2, 3), true);
  assert.equal(shouldRetry(true, 3, 3), false);
  assert.equal(shouldRetry(false, 1, 3), false);
});

test("retry delay uses 30s then 90s with bounded jitter", () => {
  assert.equal(retryDelaySeconds(1, () => 0), 24);
  assert.equal(retryDelaySeconds(1, () => 1), 36);
  assert.equal(retryDelaySeconds(2, () => 0), 72);
  assert.equal(retryDelaySeconds(2, () => 1), 108);
});
