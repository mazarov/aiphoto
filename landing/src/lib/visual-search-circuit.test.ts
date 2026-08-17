import assert from "node:assert/strict";
import test from "node:test";
import { createCircuitBreaker } from "./visual-search-circuit";

test("opens after the failure threshold and later half-opens", () => {
  const breaker = createCircuitBreaker({
    failureThreshold: 2,
    windowMs: 1_000,
    openMs: 50,
  });
  assert.equal(breaker.allow(0), true);
  breaker.failure(0);
  breaker.failure(1);
  assert.equal(breaker.state(2), "open");
  assert.equal(breaker.allow(2), false);
  assert.equal(breaker.state(60), "half_open");
  assert.equal(breaker.allow(60), true);
  assert.equal(breaker.allow(61), false);
  breaker.success(62);
  assert.equal(breaker.state(63), "closed");
});
