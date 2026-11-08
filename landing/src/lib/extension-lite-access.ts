import { isInternalGenerateAllowlistedEmail } from "@/lib/internal-generate-allowlist";
import { isVideoAnimateFlagOn } from "@/lib/video-generation-contract";

/** `landing_generation_config` key. SQL 276, default false. */
export const EXTENSION_LITE_GENERATE_CONFIG_KEY = "extension_lite_generate_enabled";

/**
 * Prod follows `extension_lite_generate_enabled`.
 * Allowlisted internals stay unlocked for pre-release QA.
 * Development mode does not unlock the product.
 */
export function isExtensionLiteGenerateUnlocked(
  value: string | undefined | null,
  userEmail?: string | null,
): boolean {
  if (isVideoAnimateFlagOn(value ?? undefined)) return true;
  return isInternalGenerateAllowlistedEmail(userEmail);
}
