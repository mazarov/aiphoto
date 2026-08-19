const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const VISITOR_COOKIE_NAME = "promptshot_vid";
export const VISITOR_COOKIE_MAX_AGE_SEC = 365 * 24 * 60 * 60;

export function sanitizeUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return UUID_PATTERN.test(trimmed) ? trimmed.toLowerCase() : null;
}

export function resolveOrMintUuid(
  stored: unknown,
  mint: () => string,
): { id: string; persist: string | null } {
  const existing = sanitizeUuid(stored);
  if (existing) return { id: existing, persist: null };
  const minted = sanitizeUuid(mint());
  if (!minted) {
    throw new Error("mint produced invalid UUID");
  }
  return { id: minted, persist: minted };
}

export function sanitizeVisitorId(value: unknown): string | null {
  return sanitizeUuid(value);
}

export function resolveOrMintVisitorId(
  stored: unknown,
  mint: () => string,
): { visitorId: string; persist: string | null } {
  const resolved = resolveOrMintUuid(stored, mint);
  return { visitorId: resolved.id, persist: resolved.persist };
}
