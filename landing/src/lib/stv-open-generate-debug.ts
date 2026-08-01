import { isInternalGenerateAllowlistedEmail } from "@/lib/internal-generate-allowlist";

/**
 * Temporary open generate for card inline UI debugging.
 * When enabled: upload/generate/poll skip credits (and may use guest DB owner).
 * Requires STV_OPEN_GENERATE_DEBUG (default on in development) AND allowlisted session email.
 */
function isStvOpenGenerateDebugFlagOn(): boolean {
  const configured = process.env.STV_OPEN_GENERATE_DEBUG?.trim();
  if (configured === "1" || configured === "true") return true;
  if (configured === "0" || configured === "false") return false;
  return process.env.NODE_ENV === "development";
}

export function isStvOpenGenerateDebugEnabled(
  userEmail?: string | null
): boolean {
  if (!isStvOpenGenerateDebugFlagOn()) return false;
  return isInternalGenerateAllowlistedEmail(userEmail);
}
