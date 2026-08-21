import { ProcessingError } from "./input-source";
import { isGrokImageModel } from "./xai-image";

/** Only skip Grok when the worker is dying — do not start another vendor call. */
const NOT_ELIGIBLE_TYPES = new Set(["shutdown"]);

export function isImageFallbackEligible(error: ProcessingError): boolean {
  return !NOT_ELIGIBLE_TYPES.has(error.errorType);
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
