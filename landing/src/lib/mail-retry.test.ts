import assert from "node:assert/strict";
import test from "node:test";
import { mailRetryDelaySeconds } from "./mail-retry";

test("retry delay uses 30s then 90s with jitter", () => {
  assert.equal(mailRetryDelaySeconds(1, () => 0.5), 30);
  assert.equal(mailRetryDelaySeconds(2, () => 0.5), 90);
  assert.equal(mailRetryDelaySeconds(1, () => 0), 24);
  assert.equal(mailRetryDelaySeconds(2, () => 1), 108);
});
