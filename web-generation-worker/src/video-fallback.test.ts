import assert from "node:assert/strict";
import test from "node:test";
import { ProcessingError } from "./input-source";
import {
  isForeignGrokVideoOperationId,
  isVideoFallbackEligible,
  shouldAttemptGrokVideoFallback,
} from "./video-fallback";

const veoSafety = new ProcessingError("safety_block", "photorealistic children", false);
const veoDown = new ProcessingError("gemini_http_503", "down", true);
const seedanceDown = new ProcessingError("seedance_http_503", "down", true);

function decision(override: Partial<Parameters<typeof shouldAttemptGrokVideoFallback>[0]> = {}) {
  return shouldAttemptGrokVideoFallback({
    requestedModel: "veo-3.1-lite-generate-preview",
    fallbackUsed: false,
    error: veoSafety,
    xaiConfigured: true,
    fallbackModel: "grok-imagine-video-1.5",
    circuitOpen: false,
    ...override,
  });
}

test("video fallback eligible after vendor call except shutdown and pre-submit", () => {
  assert.equal(isVideoFallbackEligible(veoSafety), true);
  assert.equal(isVideoFallbackEligible(veoDown), true);
  assert.equal(isVideoFallbackEligible(seedanceDown), true);
  assert.equal(isVideoFallbackEligible(new ProcessingError("timeout", "t", true)), true);
  assert.equal(isVideoFallbackEligible(new ProcessingError("config_error", "no key", false)), true);
  assert.equal(isVideoFallbackEligible(new ProcessingError("shutdown", "Worker is shutting down", true)), false);
  assert.equal(isVideoFallbackEligible(new ProcessingError("input_missing", "no frame", false)), false);
  assert.equal(isVideoFallbackEligible(new ProcessingError("result_upload_error", "storage", true)), false);
});

test("Lite or Seedance safety hops to Grok 1.5", () => {
  assert.deepEqual(decision(), { ok: true, model: "grok-imagine-video-1.5" });
  assert.deepEqual(
    decision({ requestedModel: "seedance-2.5", error: seedanceDown }),
    { ok: true, model: "grok-imagine-video-1.5" },
  );
  assert.deepEqual(
    decision({ requestedModel: "gemini-omni-flash-preview", error: veoDown }),
    { ok: true, model: "grok-imagine-video-1.5" },
  );
});

test("Grok hop is one-way and respects kill-switch and circuit", () => {
  assert.deepEqual(
    decision({ requestedModel: "grok-imagine-video-1.5" }),
    { ok: false, reason: "primary_is_grok" },
  );
  assert.deepEqual(decision({ fallbackUsed: true }), { ok: false, reason: "already_used" });
  assert.deepEqual(
    decision({ error: new ProcessingError("shutdown", "down", true) }),
    { ok: false, reason: "not_eligible" },
  );
  assert.deepEqual(decision({ xaiConfigured: false }), { ok: false, reason: "xai_unconfigured" });
  assert.deepEqual(decision({ fallbackModel: null }), { ok: false, reason: "fallback_disabled" });
  assert.deepEqual(decision({ fallbackModel: "" }), { ok: false, reason: "fallback_disabled" });
  assert.deepEqual(decision({ circuitOpen: true }), { ok: false, reason: "circuit_open" });
});

test("foreign video operation ids are not polled on xAI", () => {
  assert.equal(isForeignGrokVideoOperationId(""), false);
  assert.equal(isForeignGrokVideoOperationId("models/veo/operations/abc"), true);
  assert.equal(isForeignGrokVideoOperationId("operations/123"), true);
  assert.equal(isForeignGrokVideoOperationId("job-openrouter-1"), true);
  assert.equal(isForeignGrokVideoOperationId("req_xai_abc"), false);
});
