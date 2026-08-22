import assert from "node:assert/strict";
import test from "node:test";
import { applyMailOfferPercent } from "./mail-offer-price";

test("floors treatment catalog at 10 and 20 percent", () => {
  assert.equal(applyMailOfferPercent(99, 10), 89);
  assert.equal(applyMailOfferPercent(299, 10), 269);
  assert.equal(applyMailOfferPercent(469, 10), 422);
  assert.equal(applyMailOfferPercent(990, 10), 891);
  assert.equal(applyMailOfferPercent(99, 20), 79);
  assert.equal(applyMailOfferPercent(299, 20), 239);
  assert.equal(applyMailOfferPercent(469, 20), 375);
  assert.equal(applyMailOfferPercent(990, 20), 792);
});
