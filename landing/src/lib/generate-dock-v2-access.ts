import { isInternalGenerateAllowlistedEmail } from "@/lib/internal-generate-allowlist";
import { isVideoAnimateFlagOn } from "@/lib/video-generation-contract";

/** `landing_generation_config` key. SQL 282, default false. */
export const GENERATE_DOCK_V2_CONFIG_KEY = "generate_dock_v2_enabled";

/**
 * Prod follows `landing_generation_config.generate_dock_v2_enabled`.
 * Allowlisted internals (`azarov.maxim@gmail.com`) stay unlocked for pre-release QA.
 * Development mode does not unlock the product.
 */
export function isGenerateDockV2Unlocked(
  value: string | undefined | null,
  userEmail?: string | null,
): boolean {
  if (isVideoAnimateFlagOn(value ?? undefined)) return true;
  return isInternalGenerateAllowlistedEmail(userEmail);
}
