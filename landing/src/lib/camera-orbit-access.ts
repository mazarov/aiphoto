import { CAMERA_ORBIT_DEFAULT_MODEL } from "@/lib/camera-orbit";
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

/**
 * Orbit I2I model from DB. Empty → default Grok. Unknown / disabled id → null (503), no Flash fallback.
 */
export function resolveCameraOrbitModel<T extends { id: string }>(
  configValue: string | undefined,
  enabledModels: readonly T[],
): T | null {
  const requested = String(configValue ?? "").trim() || CAMERA_ORBIT_DEFAULT_MODEL;
  return enabledModels.find((item) => item.id === requested) ?? null;
}
