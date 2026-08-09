import assert from "node:assert/strict";
import test from "node:test";
import {
  encodeAdminGenerationCursor,
  parseAdminGenerationCursor,
  parseAdminGenerationLimit,
  parseAdminGenerationQueueStatus,
  resolveAdminPublicationStatus,
} from "./admin-generation-queue";

const DATE = "2026-08-08T12:34:56.000Z";
const ID = "123e4567-e89b-42d3-a456-426614174000";

test("admin generation cursor round-trips and rejects malformed values", () => {
  assert.deepEqual(parseAdminGenerationCursor(encodeAdminGenerationCursor(DATE, ID)), {
    createdAt: DATE,
    id: ID,
  });
  for (const value of [null, "", `|${ID}`, `${DATE}|`, `not-a-date|${ID}`, `1|${ID}`, `${DATE}|not-a-uuid`, `${DATE}|${ID}|extra`]) {
    assert.equal(parseAdminGenerationCursor(value), null);
  }
});

test("admin generation limit clamps and defaults safely", () => {
  assert.equal(parseAdminGenerationLimit(null), 30);
  assert.equal(parseAdminGenerationLimit("bad"), 30);
  assert.equal(parseAdminGenerationLimit("0"), 1);
  assert.equal(parseAdminGenerationLimit("4.9"), 4);
  assert.equal(parseAdminGenerationLimit("1000"), 100);
});

test("queue status and publication state resolve all branches", () => {
  assert.equal(parseAdminGenerationQueueStatus(null), "unpublished");
  assert.equal(parseAdminGenerationQueueStatus("PUBLISHED"), "published");
  assert.equal(parseAdminGenerationQueueStatus("invalid"), null);
  assert.equal(resolveAdminPublicationStatus({ ugc_card_id: null, card_exists: false, is_published: false }), "card_pending");
  assert.equal(resolveAdminPublicationStatus({ ugc_card_id: ID, card_exists: false, is_published: false }), "card_missing");
  assert.equal(resolveAdminPublicationStatus({ ugc_card_id: ID, card_exists: true, is_published: false }), "unpublished");
  assert.equal(resolveAdminPublicationStatus({ ugc_card_id: ID, card_exists: true, is_published: true }), "published");
});
