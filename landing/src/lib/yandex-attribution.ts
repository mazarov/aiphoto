/** First-touch Yandex Direct click id. Survives SPA navigations until checkout. */
export const YCLID_COOKIE_NAME = "promptshot_yclid";
export const YCLID_COOKIE_MAX_AGE_SEC = 21 * 24 * 60 * 60;

const YM_CLIENT_ID_PATTERN = /^\d{6,32}$/;
const YCLID_PATTERN = /^\d{9,32}$/;

export function sanitizeYmClientId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return YM_CLIENT_ID_PATTERN.test(trimmed) ? trimmed : null;
}

export function sanitizeYclid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return YCLID_PATTERN.test(trimmed) ? trimmed : null;
}

export function readYclidFromSearch(search: string): string | null {
  const normalized = search.startsWith("?") ? search.slice(1) : search;
  try {
    return sanitizeYclid(new URLSearchParams(normalized).get("yclid"));
  } catch {
    return null;
  }
}

export function resolveFirstTouchYclid(
  urlYclid: string | null,
  storedYclid: string | null,
): { yclid: string | null; persist: string | null } {
  const stored = sanitizeYclid(storedYclid);
  if (stored) return { yclid: stored, persist: null };
  const fromUrl = sanitizeYclid(urlYclid);
  if (fromUrl) return { yclid: fromUrl, persist: fromUrl };
  return { yclid: null, persist: null };
}
