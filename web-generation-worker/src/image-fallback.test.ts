import assert from "node:assert/strict";
import test from "node:test";
import { ProcessingError } from "./input-source";
import { isImageFallbackEligible, shouldAttemptImageFallback } from "./image-fallback";
import { GrokImageCircuit } from "./grok-image-circuit";

test("fallback eligible for any Gemini image error except shutdown", () => {
  assert.equal(isImageFallbackEligible(new ProcessingError("gemini_http_503", "down", true)), true);
  assert.equal(isImageFallbackEligible(new ProcessingError("timeout", "t", true)), true);
  assert.equal(isImageFallbackEligible(new ProcessingError("gemini_error", "empty", false)), true);
  assert.equal(isImageFallbackEligible(new ProcessingError("IMAGE_OTHER", "finishReason=IMAGE_OTHER", false)), true);
  assert.equal(isImageFallbackEligible(new ProcessingError("safety_block", "SAFETY", false)), true);
  assert.equal(isImageFallbackEligible(new ProcessingError("gemini_error", "blockReason=SAFETY", false)), true);
  assert.equal(isImageFallbackEligible(new ProcessingError("config_error", "no key", false)), true);
  assert.equal(isImageFallbackEligible(new ProcessingError("shutdown", "Worker is shutting down", true)), false);
});

test("IMAGE_OTHER from Flash attempts Grok", () => {
  assert.deepEqual(
    shouldAttemptImageFallback({
      requestedModel: "gemini-2.5-flash-image",
      fallbackUsed: false,
      error: new ProcessingError("IMAGE_OTHER", "finishReason=IMAGE_OTHER", false),
      xaiConfigured: true,
      fallbackModel: "grok-imagine-image-2.0",
      circuitOpen: false,
    }),
    { ok: true, model: "grok-imagine-image-2.0" },
  );
});

test("fallback is one-way Gemini to Grok", () => {
  const error = new ProcessingError("gemini_http_500", "x", true);
  assert.equal(
    shouldAttemptImageFallback({
      requestedModel: "gemini-2.5-flash-image",
      fallbackUsed: false,
      error,
      xaiConfigured: true,
      fallbackModel: "grok-imagine-image-2.0",
      circuitOpen: false,
    }).ok,
    true,
  );
  assert.equal(
    shouldAttemptImageFallback({
      requestedModel: "grok-imagine-image-2.0",
      fallbackUsed: false,
      error,
      xaiConfigured: true,
      fallbackModel: "grok-imagine-image-2.0",
      circuitOpen: false,
    }).ok,
    false,
  );
  assert.deepEqual(
    shouldAttemptImageFallback({
      requestedModel: "gemini-2.5-flash-image",
      fallbackUsed: false,
      error,
      xaiConfigured: true,
      fallbackModel: "grok-imagine-image-2.0",
      circuitOpen: true,
    }),
    { ok: false, reason: "circuit_open" },
  );
});

test("circuit opens at 50% errors over 8 samples and cools down", () => {
  let now = 1_000;
  const circuit = new GrokImageCircuit({ now: () => now });
  for (let i = 0; i < 4; i += 1) circuit.record(true);
  for (let i = 0; i < 4; i += 1) circuit.record(false);
  assert.equal(circuit.isOpen(), true);
  now += 60_000;
  assert.equal(circuit.isOpen(), false);
});
