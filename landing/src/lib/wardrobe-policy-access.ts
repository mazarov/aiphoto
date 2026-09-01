import { isInternalGenerateAllowlistedEmail } from "./internal-generate-allowlist";
import { isVideoAnimateFlagOn } from "./video-generation-contract";

export { PRESERVE_OUTFIT_CONFIG_KEY } from "./wardrobe-policy";

/**
 * Prod follows `preserve_outfit_enabled`.
 * Allowlisted internals and local `next dev` stay unlocked — same as photoshoot.
 */
export function isPreserveOutfitUnlocked(
  value: string | undefined,
  userEmail?: string | null,
): boolean {
  if (isVideoAnimateFlagOn(value)) return true;
  if (isInternalGenerateAllowlistedEmail(userEmail)) return true;
  return process.env.NODE_ENV === "development";
}
