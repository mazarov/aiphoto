import { isInternalGenerateAllowlistedEmail } from "@/lib/internal-generate-allowlist";
import { isVideoAnimateFlagOn } from "@/lib/video-generation-contract";

/**
 * Prod follows `camera_orbit_enabled`.
 * Allowlisted internals and local `next dev` stay unlocked — same pattern as video.
 */
export function isCameraOrbitUnlocked(
  value: string | undefined,
  userEmail?: string | null,
): boolean {
  if (isVideoAnimateFlagOn(value)) return true;
  if (isInternalGenerateAllowlistedEmail(userEmail)) return true;
  return process.env.NODE_ENV === "development";
}
