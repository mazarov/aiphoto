import { isInternalGenerateAllowlistedEmail } from "@/lib/internal-generate-allowlist";

/**
 * Temporary open generate for allowlisted card inline UI.
 * When enabled: generate skips credits; row is still owned by the session user.
 * Auth is always required (no anonymous open-debug).
 *
 * Requires allowlisted session email. Flag:
 * - unset → off
 * - STV_OPEN_GENERATE_DEBUG=0/false → force off
 * - STV_OPEN_GENERATE_DEBUG=1/true → on (still needs allowlisted email)
 */
function isStvOpenGenerateDebugFlagOn(): boolean {
  const configured = process.env.STV_OPEN_GENERATE_DEBUG?.trim();
  if (configured === "1" || configured === "true") return true;
  return false;
}

export function isStvOpenGenerateDebugEnabled(
  userEmail?: string | null
): boolean {
  if (!isInternalGenerateAllowlistedEmail(userEmail)) return false;
  return isStvOpenGenerateDebugFlagOn();
}
