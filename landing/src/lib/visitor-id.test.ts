import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveOrMintUuid,
  resolveOrMintVisitorId,
  sanitizeUuid,
  sanitizeVisitorId,
  VISITOR_COOKIE_MAX_AGE_SEC,
  VISITOR_COOKIE_NAME,
} from "./visitor-id";

const VALID = "263dd707-e1ee-46d9-9a97-c11ad34c289d";
const MINTED = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

test("sanitizeUuid accepts RFC-like UUIDs and lowercases them", () => {
  assert.equal(sanitizeUuid(VALID.toUpperCase()), VALID);
  assert.equal(sanitizeVisitorId(` ${VALID} `), VALID);
  assert.equal(sanitizeUuid("not-a-uuid"), null);
  assert.equal(sanitizeUuid(""), null);
  assert.equal(sanitizeUuid(VALID.replace("d", "z")), null);
  assert.equal(sanitizeUuid("00000000-0000-0000-0000-000000000000"), null);
});

test("resolveOrMintVisitorId keeps a stored id and mints once when missing", () => {
  assert.deepEqual(resolveOrMintVisitorId(VALID, () => MINTED), {
    visitorId: VALID,
    persist: null,
  });
  assert.deepEqual(resolveOrMintVisitorId("bad", () => MINTED), {
    visitorId: MINTED,
    persist: MINTED,
  });
  assert.deepEqual(resolveOrMintUuid(null, () => MINTED), {
    id: MINTED,
    persist: MINTED,
  });
});

test("visitor cookie contract is first-party and yearly", () => {
  assert.equal(VISITOR_COOKIE_NAME, "promptshot_vid");
  assert.equal(VISITOR_COOKIE_MAX_AGE_SEC, 365 * 24 * 60 * 60);
});
