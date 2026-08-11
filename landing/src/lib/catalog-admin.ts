import { isInternalGenerateAllowlistedEmail } from "@/lib/internal-generate-allowlist";

/**
 * Catalog admin tools (filters on listings, unpublished cards, set-before / delete).
 * Same email allowlist as internal generate (default azarov.maxim@gmail.com).
 */
export function isCatalogAdminEmail(email?: string | null): boolean {
  return isInternalGenerateAllowlistedEmail(email);
}
