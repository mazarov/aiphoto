import { resolveOrMintUuid, sanitizeUuid } from "./visitor-id";

export const SESSION_STORAGE_KEY = "promptshot_sid";

export function sanitizeSessionId(value: unknown): string | null {
  return sanitizeUuid(value);
}

export function resolveOrMintSessionId(
  stored: unknown,
  mint: () => string,
): { sessionId: string; persist: string | null } {
  const resolved = resolveOrMintUuid(stored, mint);
  return { sessionId: resolved.id, persist: resolved.persist };
}

export function readOrCreateBrowserSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const resolved = resolveOrMintSessionId(
      sessionStorage.getItem(SESSION_STORAGE_KEY),
      () => crypto.randomUUID(),
    );
    if (resolved.persist) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, resolved.persist);
    }
    return resolved.sessionId;
  } catch {
    return null;
  }
}
