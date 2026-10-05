import { isInternalGenerateAllowlistedEmail } from "@/lib/internal-generate-allowlist";
import { isStickerFlagOn } from "@/lib/sticker";

/**
 * Prod follows `landing_generation_config.sticker_generation_enabled`.
 * Allowlisted internals stay unlocked for pre-release QA — same pattern as photoshoot / orbit.
 */
export function isStickerUnlocked(
  value: string | undefined | null,
  userEmail?: string | null,
): boolean {
  if (isStickerFlagOn(value)) return true;
  return isInternalGenerateAllowlistedEmail(userEmail);
}
