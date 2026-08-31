import { isInternalGenerateAllowlistedEmail } from "./internal-generate-allowlist";
import { isVideoAnimateFlagOn } from "./video-generation-contract";

/**
 * Prod follows `listing_video_repeat_chain`.
 * Allowlisted internals and local `next dev` stay unlocked — same as video.
 */
export function isListingVideoRepeatUnlocked(
  value: string | undefined,
  userEmail?: string | null,
): boolean {
  if (isVideoAnimateFlagOn(value)) return true;
  if (isInternalGenerateAllowlistedEmail(userEmail)) return true;
  return process.env.NODE_ENV === "development";
}
