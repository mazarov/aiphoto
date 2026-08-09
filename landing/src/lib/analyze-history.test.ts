import assert from "node:assert/strict";
import test from "node:test";
import {
  encodeAnalyzeHistoryCursor,
  parseAnalyzeHistoryCursor,
  parseAnalyzeHistoryLimit,
} from "./analyze-history";

const DATE = "2026-08-08T21:00:00.000Z";
const ID = "9c0e4de5-8c82-4c3e-8d9c-e1ef4b47a0dd";

test("analyze history cursor round-trips and rejects malformed values", () => {
  assert.deepEqual(parseAnalyzeHistoryCursor(encodeAnalyzeHistoryCursor(DATE, ID)), {
    createdAt: DATE,
    id: ID,
  });
  for (const value of [null, "", `|${ID}`, `${DATE}|`, `invalid|${ID}`, `1|${ID}`, `${DATE}|bad`, `${DATE}|${ID}|extra`]) {
    assert.equal(parseAnalyzeHistoryCursor(value), null);
  }
});

test("analyze history limit defaults, floors, and clamps", () => {
  assert.equal(parseAnalyzeHistoryLimit(null), 30);
  assert.equal(parseAnalyzeHistoryLimit("NaN"), 30);
  assert.equal(parseAnalyzeHistoryLimit("-5"), 1);
  assert.equal(parseAnalyzeHistoryLimit("12.8"), 12);
  assert.equal(parseAnalyzeHistoryLimit("101"), 100);
});
