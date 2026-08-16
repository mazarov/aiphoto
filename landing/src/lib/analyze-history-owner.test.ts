import assert from "node:assert/strict";
import test from "node:test";
import { analyzeHistoryOwnerOrFilter } from "./analyze-history-owner";

const A = "9c0e4de5-8c82-4c3e-8d9c-e1ef4b47a0dd";
const B = "1a2b3c4d-5e6f-4789-8abc-def012345678";

test("analyzeHistoryOwnerOrFilter uses one clause when ids match", () => {
  assert.equal(analyzeHistoryOwnerOrFilter(A, A), `user_id.eq.${A}`);
});

test("analyzeHistoryOwnerOrFilter ors auth and shared db ids", () => {
  assert.equal(
    analyzeHistoryOwnerOrFilter(A, B),
    `user_id.eq.${A},user_id.eq.${B}`,
  );
});

test("analyzeHistoryOwnerOrFilter rejects non-uuid ids", () => {
  assert.equal(analyzeHistoryOwnerOrFilter("nope", A), null);
  assert.equal(analyzeHistoryOwnerOrFilter(A, "user_id.eq.hack"), null);
});
