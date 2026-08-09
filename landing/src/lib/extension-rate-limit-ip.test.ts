import assert from "node:assert/strict";
import test from "node:test";
import {
  extensionRateLimitDayWindowStartIso,
  extensionRateLimitEffectiveUsage,
  extensionRateLimitIpHash,
  extensionRateLimitParsedIp,
} from "./extension-rate-limit-ip";

test("rate-limit IP parsing prefers the first forwarded address", () => {
  assert.equal(extensionRateLimitParsedIp(new Headers({
    "x-forwarded-for": " 203.0.113.10, 10.0.0.1 ",
    "x-real-ip": "198.51.100.2",
  })), "203.0.113.10");
  assert.equal(extensionRateLimitParsedIp(new Headers({ "x-real-ip": " 198.51.100.2 " })), "198.51.100.2");
  assert.equal(extensionRateLimitParsedIp(new Headers()), "unknown");
});

test("rate-limit hash is stable within a UTC day and rotates next day", () => {
  const first = new Date("2026-08-08T00:00:00.000Z");
  const sameDay = new Date("2026-08-08T23:59:59.999Z");
  const nextDay = new Date("2026-08-09T00:00:00.000Z");
  const hash = extensionRateLimitIpHash("203.0.113.10", first);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(extensionRateLimitIpHash("203.0.113.10", sameDay), hash);
  assert.notEqual(extensionRateLimitIpHash("203.0.113.10", nextDay), hash);
});

test("rate-limit day window and effective usage include reservations", () => {
  assert.equal(
    extensionRateLimitDayWindowStartIso(new Date("2026-08-08T18:45:12.123Z")),
    "2026-08-08T00:00:00.000Z",
  );
  assert.equal(extensionRateLimitEffectiveUsage({ count: 12, pending: 3 }), 15);
});
