import { ProcessingError } from "./input-source";
import { isGrokVideoModel } from "./xai-video";

/** Skip hop only when the worker is dying or the primary never reached the vendor. */
const NOT_ELIGIBLE_TYPES = new Set([
  "shutdown",
  "input_missing",
  "input_invalid",
  "result_upload_error",
  "storage_signed_url_error",
  "provider_operation_persist_failed",
  "parent_generation_lookup_error",
  "parent_generation_missing",
  "parent_generation_forbidden",
  "parent_generation_not_ready",
  "video_source_required",
]);

export function isVideoFallbackEligible(error: ProcessingError): boolean {
  return !NOT_ELIGIBLE_TYPES.has(error.errorType);
}

export function shouldAttemptGrokVideoFallback(input: {
  requestedModel: string;
  fallbackUsed: boolean;
  error: ProcessingError;
  xaiConfigured: boolean;
  fallbackModel: string | null;
  circuitOpen: boolean;
}): { ok: true; model: string } | { ok: false; reason: string } {
  if (isGrokVideoModel(input.requestedModel)) {
    return { ok: false, reason: "primary_is_grok" };
  }
  if (input.fallbackUsed) return { ok: false, reason: "already_used" };
  if (!isVideoFallbackEligible(input.error)) return { ok: false, reason: "not_eligible" };
  if (!input.xaiConfigured) return { ok: false, reason: "xai_unconfigured" };
  if (!input.fallbackModel || !isGrokVideoModel(input.fallbackModel)) {
    return { ok: false, reason: "fallback_disabled" };
  }
  if (input.circuitOpen) return { ok: false, reason: "circuit_open" };
  return { ok: true, model: input.fallbackModel };
}

/** Gemini/Veo/OpenRouter ids must not be polled on xAI after a hop. */
export function isForeignGrokVideoOperationId(operationId: string): boolean {
  const id = operationId.trim();
  if (!id) return false;
  return /models\/|operations\//i.test(id) || /^job-/i.test(id);
}
