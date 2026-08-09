import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAdminEnqueueIdentity,
  normalizeAdminIdempotencyBase,
  resolveAdminGenerationModel,
} from "./admin-generation-enqueue";

test("admin idempotency base validates supplied keys and uses a safe fallback", () => {
  assert.equal(normalizeAdminIdempotencyBase(" admin:request_123 ", "fallback-key"), "admin:request_123");
  assert.equal(normalizeAdminIdempotencyBase("", "admin:fallback_123"), "admin:fallback_123");
  assert.equal(normalizeAdminIdempotencyBase("short", "admin:fallback_123"), null);
  assert.equal(normalizeAdminIdempotencyBase("contains spaces", "admin:fallback_123"), null);
  assert.equal(normalizeAdminIdempotencyBase("x".repeat(119), "admin:fallback_123"), null);
});

test("admin enqueue identity is stable per item and unique across count indexes", () => {
  const input = {
    baseKey: "admin:request_123",
    requesterAuthUserId: "auth-user",
    dbUserId: "shared-user",
    prompt: "Create a studio portrait",
    model: "gemini-model",
    aspectRatio: "9:16",
    imageSize: "1K",
    photoPath: "admin/pinned-reference/photo.jpg",
  };
  const first = buildAdminEnqueueIdentity({ ...input, index: 0 });
  assert.deepEqual(buildAdminEnqueueIdentity({ ...input, index: 0 }), first);
  assert.equal(first.idempotencyKey, "admin:request_123:0");
  assert.match(first.fingerprint, /^[0-9a-f]{64}$/);
  const second = buildAdminEnqueueIdentity({ ...input, index: 1 });
  assert.notEqual(second.idempotencyKey, first.idempotencyKey);
  assert.notEqual(second.fingerprint, first.fingerprint);
});

test("admin model selection rejects an explicitly disabled or unknown model", () => {
  const models = [
    { id: "enabled", enabled: true },
    { id: "disabled", enabled: false },
  ];
  assert.equal(resolveAdminGenerationModel(models, "enabled", "enabled"), "enabled");
  assert.equal(resolveAdminGenerationModel(models, "disabled", "enabled"), null);
  assert.equal(resolveAdminGenerationModel(models, "unknown", "enabled"), null);
  assert.equal(resolveAdminGenerationModel(models, undefined, "enabled"), "enabled");
  assert.equal(resolveAdminGenerationModel([null, "bad", {}, ...models], undefined, "enabled"), "enabled");
  assert.equal(resolveAdminGenerationModel([], undefined, undefined), null);
});
