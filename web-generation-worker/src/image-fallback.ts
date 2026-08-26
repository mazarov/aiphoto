import { isFluxImageModel, isSeedreamImageModel } from "./openrouter-seedream";
import { ProcessingError } from "./input-source";
import { isGrokImageModel } from "./xai-image";

/** Only skip the next vendor when the worker is dying. */
const NOT_ELIGIBLE_TYPES = new Set(["shutdown"]);

export function isImageFallbackEligible(error: ProcessingError): boolean {
  return !NOT_ELIGIBLE_TYPES.has(error.errorType);
}

export function shouldAttemptGrokFallback(input: {
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
  if (isSeedreamImageModel(input.requestedModel)) {
    return { ok: false, reason: "primary_is_seedream" };
  }
  if (isFluxImageModel(input.requestedModel)) {
    return { ok: false, reason: "primary_is_flux" };
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

/** @deprecated Use shouldAttemptGrokFallback. */
export const shouldAttemptImageFallback = shouldAttemptGrokFallback;

export function shouldAttemptSeedreamFallback(input: {
  requestedModel: string;
  executedModel?: string | null;
  error: ProcessingError;
  openrouterConfigured: boolean;
  secondaryModel: string | null;
  circuitOpen: boolean;
}): { ok: true; model: string } | { ok: false; reason: string } {
  if (isSeedreamImageModel(input.requestedModel) || isSeedreamImageModel(input.executedModel)) {
    return { ok: false, reason: "already_seedream" };
  }
  if (!isImageFallbackEligible(input.error)) return { ok: false, reason: "not_eligible" };
  if (!input.openrouterConfigured) return { ok: false, reason: "openrouter_unconfigured" };
  if (!input.secondaryModel || !isSeedreamImageModel(input.secondaryModel)) {
    return { ok: false, reason: "secondary_disabled" };
  }
  if (input.circuitOpen) return { ok: false, reason: "circuit_open" };
  return { ok: true, model: input.secondaryModel };
}
