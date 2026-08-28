import { PHOTOSHOOT_DEFAULT_MODEL } from "@/lib/photoshoot";
import { isInternalGenerateAllowlistedEmail } from "@/lib/internal-generate-allowlist";
import { isVideoAnimateFlagOn } from "@/lib/video-generation-contract";

/**
 * Prod follows `photoshoot_enabled`.
 * Allowlisted internals and local `next dev` stay unlocked — same pattern as video/orbit.
 */
export function isPhotoshootUnlocked(
  value: string | undefined,
  userEmail?: string | null,
): boolean {
  if (isVideoAnimateFlagOn(value)) return true;
  if (isInternalGenerateAllowlistedEmail(userEmail)) return true;
  return process.env.NODE_ENV === "development";
}

/**
 * Photoshoot I2I model from DB. Empty → default Gemini 3 Pro Image. Unknown / disabled id → null (503), no Flash fallback.
 */
export function resolvePhotoshootModel<T extends { id: string }>(
  configValue: string | undefined,
  enabledModels: readonly T[],
): T | null {
  const requested = String(configValue ?? "").trim() || PHOTOSHOOT_DEFAULT_MODEL;
  return enabledModels.find((item) => item.id === requested) ?? null;
}
