import assert from "node:assert/strict";
import test from "node:test";
import {
  encodeAdminCreditCursor,
  parseAdminCreditCursor,
  parseAdminCreditLimit,
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
