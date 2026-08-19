import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveOrMintSessionId,
  sanitizeSessionId,
  SESSION_STORAGE_KEY,
} from "./browser-session-id";

const VALID = "11111111-2222-4333-8444-555555555555";
const MINTED = "66666666-7777-4888-8999-000000000000";

test("sanitizeSessionId rejects invalid UUIDs", () => {
  assert.equal(sanitizeSessionId(VALID), VALID);
  assert.equal(sanitizeSessionId("session-1"), null);
  assert.equal(sanitizeSessionId(12), null);
});

test("resolveOrMintSessionId mints once and does not rotate a stored id", () => {
  assert.deepEqual(resolveOrMintSessionId(VALID, () => MINTED), {
    sessionId: VALID,
    persist: null,
  });
  assert.deepEqual(resolveOrMintSessionId(null, () => MINTED), {
    sessionId: MINTED,
    persist: MINTED,
  });
  assert.equal(SESSION_STORAGE_KEY, "promptshot_sid");
});
