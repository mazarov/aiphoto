import {
  resolveOrMintVisitorId,
  sanitizeVisitorId,
  VISITOR_COOKIE_MAX_AGE_SEC,
  VISITOR_COOKIE_NAME,
} from "./visitor-id";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const entry = part.trim();
    if (entry.startsWith(prefix)) {
      try {
        return decodeURIComponent(entry.slice(prefix.length));
      } catch {
        return entry.slice(prefix.length);
      }
    }
  }
  return null;
}

function writeFirstPartyCookie(name: string, value: string, maxAgeSec: number): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${secure}`;
}

export function readOrCreateBrowserVisitorId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const cookieVisitorId = readCookie(VISITOR_COOKIE_NAME);
    const storedVisitorId = localStorage.getItem(VISITOR_COOKIE_NAME);
    const resolved = resolveOrMintVisitorId(
      cookieVisitorId ?? storedVisitorId,
      () => crypto.randomUUID(),
    );
    if (!cookieVisitorId) {
      writeFirstPartyCookie(
        VISITOR_COOKIE_NAME,
        resolved.visitorId,
        VISITOR_COOKIE_MAX_AGE_SEC,
      );
    }
    if (storedVisitorId !== resolved.visitorId) {
      localStorage.setItem(VISITOR_COOKIE_NAME, resolved.visitorId);
    }
    return resolved.visitorId;
  } catch {
    return sanitizeVisitorId(readCookie(VISITOR_COOKIE_NAME));
  }
}
