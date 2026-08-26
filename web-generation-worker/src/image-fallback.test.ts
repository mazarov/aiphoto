import assert from "node:assert/strict";
import test from "node:test";
import { ProcessingError } from "./input-source";
import {
  isImageFallbackEligible,
  shouldAttemptGrokFallback,
  shouldAttemptSeedreamFallback,
} from "./image-fallback";
import { GrokImageCircuit } from "./grok-image-circuit";

const grokError = new ProcessingError("grok_http_500", "x", true);
const geminiError = new ProcessingError("IMAGE_OTHER", "finishReason=IMAGE_OTHER", false);

test("fallback eligible for any Gemini image error except shutdown", () => {
  assert.equal(isImageFallbackEligible(new ProcessingError("gemini_http_503", "down", true)), true);
  assert.equal(isImageFallbackEligible(new ProcessingError("timeout", "t", true)), true);
  assert.equal(isImageFallbackEligible(new ProcessingError("gemini_error", "empty", false)), true);
  assert.equal(isImageFallbackEligible(geminiError), true);
  assert.equal(isImageFallbackEligible(new ProcessingError("safety_block", "SAFETY", false)), true);
  assert.equal(isImageFallbackEligible(new ProcessingError("config_error", "no key", false)), true);
  assert.equal(isImageFallbackEligible(new ProcessingError("shutdown", "Worker is shutting down", true)), false);
});

test("IMAGE_OTHER from Flash attempts Grok", () => {
  assert.deepEqual(
    shouldAttemptGrokFallback({
      requestedModel: "gemini-2.5-flash-image",
      fallbackUsed: false,
      error: geminiError,
      xaiConfigured: true,
      fallbackModel: "grok-imagine-image-2.0",
      circuitOpen: false,
    }),
    { ok: true, model: "grok-imagine-image-2.0" },
  );
});

test("Grok hop is one-way Gemini to Grok", () => {
  assert.equal(
    shouldAttemptGrokFallback({
      requestedModel: "grok-imagine-image-2.0",
      fallbackUsed: false,
      error: geminiError,
      xaiConfigured: true,
      fallbackModel: "grok-imagine-image-2.0",
      circuitOpen: false,
    }).ok,
    false,
  );
  assert.deepEqual(
    shouldAttemptGrokFallback({
      requestedModel: "gemini-2.5-flash-image",
      fallbackUsed: false,
      error: geminiError,
      xaiConfigured: true,
      fallbackModel: "grok-imagine-image-2.0",
      circuitOpen: true,
    }),
    { ok: false, reason: "circuit_open" },
  );
  assert.deepEqual(
    shouldAttemptGrokFallback({
      requestedModel: "seedream-4.5",
      fallbackUsed: false,
      error: geminiError,
      xaiConfigured: true,
      fallbackModel: "grok-imagine-image-2.0",
      circuitOpen: false,
    }),
    { ok: false, reason: "primary_is_seedream" },
  );
  assert.deepEqual(
    shouldAttemptGrokFallback({
      requestedModel: "flux-2-flex",
      fallbackUsed: false,
      error: geminiError,
      xaiConfigured: true,
      fallbackModel: "grok-imagine-image-2.0",
      circuitOpen: false,
    }),
    { ok: false, reason: "primary_is_flux" },
  );
});

test("Seedream hop runs after Grok primary or Grok fallback fail", () => {
  assert.deepEqual(
    shouldAttemptSeedreamFallback({
      requestedModel: "grok-imagine-image-2.0",
      error: grokError,
      openrouterConfigured: true,
      secondaryModel: "seedream-5.0-pro",
      circuitOpen: false,
    }),
    { ok: true, model: "seedream-5.0-pro" },
  );
  assert.deepEqual(
    shouldAttemptSeedreamFallback({
      requestedModel: "grok-imagine-image-2.0",
      error: grokError,
      openrouterConfigured: true,
      secondaryModel: "seedream-4.5",
      circuitOpen: false,
    }),
    { ok: true, model: "seedream-4.5" },
  );
  assert.deepEqual(
    shouldAttemptSeedreamFallback({
      requestedModel: "gemini-2.5-flash-image",
      executedModel: "grok-imagine-image-2.0",
      error: grokError,
      openrouterConfigured: true,
      secondaryModel: "seedream-4.5",
      circuitOpen: false,
    }),
    { ok: true, model: "seedream-4.5" },
  );
});

test("Seedream hop skips when already Seedream or kill-switch", () => {
  assert.deepEqual(
    shouldAttemptSeedreamFallback({
      requestedModel: "seedream-4.5",
      error: grokError,
      openrouterConfigured: true,
      secondaryModel: "seedream-4.5",
      circuitOpen: false,
    }),
    { ok: false, reason: "already_seedream" },
  );
  assert.deepEqual(
    shouldAttemptSeedreamFallback({
      requestedModel: "gemini-2.5-flash-image",
      executedModel: "seedream-4.5",
      error: grokError,
      openrouterConfigured: true,
      secondaryModel: "seedream-4.5",
      circuitOpen: false,
    }),
    { ok: false, reason: "already_seedream" },
  );
  assert.deepEqual(
    shouldAttemptSeedreamFallback({
      requestedModel: "grok-imagine-image-2.0",
      error: grokError,
      openrouterConfigured: true,
      secondaryModel: null,
      circuitOpen: false,
    }),
    { ok: false, reason: "secondary_disabled" },
  );
  assert.deepEqual(
    shouldAttemptSeedreamFallback({
      requestedModel: "grok-imagine-image-2.0",
      error: new ProcessingError("shutdown", "down", true),
      openrouterConfigured: true,
      secondaryModel: "seedream-4.5",
      circuitOpen: false,
    }),
    { ok: false, reason: "not_eligible" },
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
