import { isInternalGenerateAllowlistedEmail } from "./internal-generate-allowlist";
import { isVideoAnimateFlagOn } from "./video-generation-contract";

export { COMPOSE_EXAMPLE_MATCH_CONFIG_KEY } from "./compose-example-audience";

/**
 * Prod follows `compose_example_match_enabled`.
 * Allowlisted internals and local `next dev` stay unlocked — same as photoshoot.
 */
export function isComposeExampleMatchUnlocked(
  value: string | undefined,
  userEmail?: string | null,
): boolean {
  if (isVideoAnimateFlagOn(value)) return true;
  if (isInternalGenerateAllowlistedEmail(userEmail)) return true;
  return process.env.NODE_ENV === "development";
}
