import assert from "node:assert/strict";
import test from "node:test";
import {
  encodeAdminCreditCursor,
  parseAdminCreditCursor,
  parseAdminCreditDays,
  parseAdminCreditLimit,
  parseAdminCreditSearch,
  reconstructCreditRemaining,
} from "./admin-credits";

const ID = "123e4567-e89b-42d3-a456-426614174000";

test("admin credit cursor round-trips and rejects malformed values", () => {
  assert.deepEqual(parseAdminCreditCursor(encodeAdminCreditCursor(150, ID)), {
    credits: 150,
    id: ID,
  });
  for (const value of [null, "", `|${ID}`, `150|`, "150|not-a-uuid", "1.5|${ID}", `${ID}|150`, `150|${ID}|extra`]) {
    assert.equal(parseAdminCreditCursor(value), null);
  }
});

test("admin credit limit clamps and defaults safely", () => {
  assert.equal(parseAdminCreditLimit(null), 30);
  assert.equal(parseAdminCreditLimit("bad"), 30);
  assert.equal(parseAdminCreditLimit("0"), 1);
  assert.equal(parseAdminCreditLimit("1000"), 100);
});

test("admin credit days accept only dashboard periods", () => {
  assert.equal(parseAdminCreditDays(null), 30);
  assert.equal(parseAdminCreditDays("7"), 7);
  assert.equal(parseAdminCreditDays("14"), 30);
});

test("admin credit search trims and caps", () => {
  assert.equal(parseAdminCreditSearch("  "), null);
  assert.equal(parseAdminCreditSearch("  ana@x  "), "ana@x");
  assert.equal(parseAdminCreditSearch("x".repeat(90))?.length, 80);
});

test("reconstruct remaining walks backward from the live total", () => {
  const series = reconstructCreditRemaining(100, [
    { day: "2026-08-14", granted: 50, spent: 10, refunded: 0 },
    { day: "2026-08-15", granted: 20, spent: 5, refunded: 0 },
    { day: "2026-08-16", granted: 10, spent: 15, refunded: 0 },
  ]);
  assert.deepEqual(series.map((row) => row.remaining), [90, 105, 100]);
});
