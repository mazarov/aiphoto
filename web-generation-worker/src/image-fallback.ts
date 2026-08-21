import { ProcessingError } from "./input-source";
import { isGrokImageModel } from "./xai-image";

const NOT_ELIGIBLE_TYPES = new Set([
  "safety_block",
  "input_missing",
  "config_error",
  "vibe_reference_missing",
  "shutdown",
  "parent_generation_missing",
  "parent_generation_forbidden",
  "parent_generation_not_ready",
  "parent_generation_lookup_error",
]);

export function isImageFallbackEligible(error: ProcessingError): boolean {
  if (NOT_ELIGIBLE_TYPES.has(error.errorType)) return false;
  const haystack = `${error.errorType} ${error.message}`;
  if (/safety|recitation|policy|prohibited|blocklist|blockreason/i.test(haystack)) {
    return false;
  }
  if (error.retryable) return true;
  if (/^gemini_http_/.test(error.errorType)) return true;
  if (error.errorType === "gemini_error") return true;
  if (error.errorType === "gemini_response_parse") return true;
  if (error.errorType === "timeout" || error.errorType === "network_error") return true;
  return false;
}

export function shouldAttemptImageFallback(input: {
  requestedModel: string;
  fallbackUsed: boolean;
  error: ProcessingError;
  xaiConfigured: boolean;
  fallbackModel: string | null;
  circuitOpen: boolean;
}): { ok: true; model: string } | { ok: false; reason: string } {
  if (isGrokImageModel(input.requestedModel)) {
    return { ok: false, reason: "primary_is_grok" };
  }
  if (input.fallbackUsed) return { ok: false, reason: "already_used" };
  if (!isImageFallbackEligible(input.error)) return { ok: false, reason: "not_eligible" };
  if (!input.xaiConfigured) return { ok: false, reason: "xai_unconfigured" };
  if (!input.fallbackModel || !isGrokImageModel(input.fallbackModel)) {
    return { ok: false, reason: "fallback_disabled" };
  }
  if (input.circuitOpen) return { ok: false, reason: "circuit_open" };
  return { ok: true, model: input.fallbackModel };
}
