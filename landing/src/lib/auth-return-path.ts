/** Cookie + sessionStorage key for post-OAuth return path. */
export const AUTH_RETURN_PATH_KEY = "promptshot:auth-return-path";
export const AUTH_RETURN_COOKIE = "ps_auth_next";
export const AUTH_RETURN_TTL_SEC = 10 * 60;

/** One-shot query + cookie so the return document is not the pre-login bfcache entry. */
export const AUTH_RETURN_FLAG = "ps_auth";
export const AUTH_RETURN_FLAG_VALUE = "1";
export const AUTH_RETURN_OVERLAY_QUERY = "ps_ov";
export const AUTH_RETURN_SCROLL_QUERY = "ps_sy";
export const AUTH_RETURN_SCROLL_COOKIE = "ps_auth_sy";
export const AUTH_RETURN_SCROLL_KEY = "promptshot:auth-return-scroll";
export const AUTH_RETURN_DONE_COOKIE = "ps_auth_done";
const AUTH_RETURN_DONE_MAX_AGE_SEC = 60;

/** Same-origin relative path only (`/pricing?test=true`). */
export function sanitizeAuthReturnPath(raw: string | null | undefined): string {
  if (!raw) return "/";
  const path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
    return "/";
  }
  // Drop prior auth_error so retries don't accumulate ?auth_error=&auth_error=
  // Drop ps_auth so remembered next stays the real page, not the bust token.
  try {
    const url = new URL(path, "https://promptshot.local");
    url.searchParams.delete("auth_error");
    url.searchParams.delete("error");
    url.searchParams.delete("error_code");
    url.searchParams.delete("error_description");
    url.searchParams.delete(AUTH_RETURN_FLAG);
    url.searchParams.delete(AUTH_RETURN_OVERLAY_QUERY);
    url.searchParams.delete(AUTH_RETURN_SCROLL_QUERY);
    const search = url.searchParams.toString();
    return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
  } catch {
    return path;
  }
}

function pathFromLocalUrl(url: URL): string {
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
}

/** After a successful PKCE exchange — different URL than the frozen guest page. */
export function appendAuthReturnMarker(
  path: string,
  overlayRaw?: string | null,
  scrollY?: number | null
): string {
  const safe = sanitizeAuthReturnPath(path);
  try {
    const url = new URL(safe, "https://promptshot.local");
    url.searchParams.set(AUTH_RETURN_FLAG, AUTH_RETURN_FLAG_VALUE);
    const overlay = overlayRaw?.trim();
    if (overlay) {
      url.searchParams.set(AUTH_RETURN_OVERLAY_QUERY, overlay);
    }
    const y = sanitizeAuthReturnScrollY(scrollY);
    if (y !== null && y > 0) {
      url.searchParams.set(AUTH_RETURN_SCROLL_QUERY, String(y));
    }
    return pathFromLocalUrl(url);
  } catch {
    return safe;
  }
}

export function readAuthReturnOverlayFromHref(href: string): string | null {
  try {
    const url = new URL(href, "https://promptshot.local");
    const overlay = url.searchParams.get(AUTH_RETURN_OVERLAY_QUERY)?.trim();
    return overlay || null;
  } catch {
    return null;
  }
}

export function sanitizeAuthReturnScrollY(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const value = typeof raw === "number" ? raw : Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.min(Math.round(value), 1_000_000);
}

export function readAuthReturnScrollFromHref(href: string): number | null {
  try {
    const url = new URL(href, "https://promptshot.local");
    return sanitizeAuthReturnScrollY(url.searchParams.get(AUTH_RETURN_SCROLL_QUERY));
  } catch {
    return null;
  }
}

export function hasAuthReturnRestoreSignal(
  href: string,
  hasDoneCookie: boolean
): boolean {
  try {
    const url = new URL(href, "https://promptshot.local");
    if (url.searchParams.get(AUTH_RETURN_FLAG) === AUTH_RETURN_FLAG_VALUE) {
      return true;
    }
    if (url.searchParams.get(AUTH_RETURN_OVERLAY_QUERY)?.trim()) {
      return true;
    }
    if (sanitizeAuthReturnScrollY(url.searchParams.get(AUTH_RETURN_SCROLL_QUERY))) {
      return true;
    }
  } catch {
    // ignore
  }
  return hasDoneCookie;
}

export function consumeAuthReturnMarkerFromHref(href: string): {
  found: boolean;
  nextHref: string;
} {
  try {
    const url = new URL(href, "https://promptshot.local");
    const found =
      url.searchParams.get(AUTH_RETURN_FLAG) === AUTH_RETURN_FLAG_VALUE ||
      Boolean(url.searchParams.get(AUTH_RETURN_OVERLAY_QUERY)?.trim()) ||
      sanitizeAuthReturnScrollY(url.searchParams.get(AUTH_RETURN_SCROLL_QUERY)) !==
        null;
    if (!found) {
      return { found: false, nextHref: `${url.pathname}${url.search}${url.hash}` };
    }
    url.searchParams.delete(AUTH_RETURN_FLAG);
    url.searchParams.delete(AUTH_RETURN_OVERLAY_QUERY);
    url.searchParams.delete(AUTH_RETURN_SCROLL_QUERY);
    return { found: true, nextHref: pathFromLocalUrl(url) };
  } catch {
    return { found: false, nextHref: "/" };
  }
}

function cookieSecureSuffix(): string {
  return typeof location !== "undefined" && location.protocol === "https:"
    ? "; Secure"
    : "";
}

export function writeAuthCookie(name: string, value: string, maxAgeSec: number): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${cookieSecureSuffix()}`;
}

export function readAuthCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
}

export function isBlockedAuthReturnPath(path: string): boolean {
  const pathname = (path.split("?")[0] ?? path).split("#")[0] ?? path;
  const norm =
    pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  return (
    norm === "/auth" ||
    norm.startsWith("/auth/") ||
    norm === "/api" ||
    norm.startsWith("/api/")
  );
}

/** Same-origin destination; auth/api callbacks collapse to home. */
export function sanitizeAuthReturnDestination(
  raw: string | null | undefined
): string {
  const safe = sanitizeAuthReturnPath(raw);
  return isBlockedAuthReturnPath(safe) ? "/" : safe;
}

/**
 * sessionStorage first, then `ps_auth_next`. Either missing → null
 * (do not treat that as `/` — caller may have a better `?next=`).
 */
export function resolveRememberedReturnPath(
  sessionValue: string | null | undefined,
  cookieValue: string | null | undefined
): string | null {
  const raw = sessionValue || cookieValue;
  if (!raw) return null;
  return sanitizeAuthReturnDestination(raw);
}

export function persistAuthReturnPath(path: string): void {
  const safe = sanitizeAuthReturnDestination(path);
  try {
    sessionStorage.setItem(AUTH_RETURN_PATH_KEY, safe);
  } catch {
    // private mode / quota
  }
  writeAuthCookie(AUTH_RETURN_COOKIE, safe, AUTH_RETURN_TTL_SEC);
}

export function peekAuthReturnPath(): string | null {
  let stored: string | null = null;
  try {
    stored = sessionStorage.getItem(AUTH_RETURN_PATH_KEY);
  } catch {
    // ignore
  }
  return resolveRememberedReturnPath(stored, readAuthCookie(AUTH_RETURN_COOKIE));
}

export function consumeAuthReturnPath(): string | null {
  const path = peekAuthReturnPath();
  try {
    sessionStorage.removeItem(AUTH_RETURN_PATH_KEY);
  } catch {
    // ignore
  }
  writeAuthCookie(AUTH_RETURN_COOKIE, "", 0);
  return path;
}

export function persistAuthReturnScrollY(y: number | null): void {
  const safe = sanitizeAuthReturnScrollY(y);
  if (safe === null || safe === 0) {
    try {
      sessionStorage.removeItem(AUTH_RETURN_SCROLL_KEY);
    } catch {
      // ignore
    }
    writeAuthCookie(AUTH_RETURN_SCROLL_COOKIE, "", 0);
    return;
  }
  try {
    sessionStorage.setItem(AUTH_RETURN_SCROLL_KEY, String(safe));
  } catch {
    // private mode / quota
  }
  writeAuthCookie(AUTH_RETURN_SCROLL_COOKIE, String(safe), AUTH_RETURN_TTL_SEC);
}

export function peekAuthReturnScrollY(): number | null {
  let stored: string | null = null;
  try {
    stored = sessionStorage.getItem(AUTH_RETURN_SCROLL_KEY);
  } catch {
    // ignore
  }
  return (
    sanitizeAuthReturnScrollY(stored) ??
    sanitizeAuthReturnScrollY(readAuthCookie(AUTH_RETURN_SCROLL_COOKIE))
  );
}

export function consumeAuthReturnScrollY(): number | null {
  const y = peekAuthReturnScrollY();
  persistAuthReturnScrollY(null);
  return y;
}

/** True on the post-OAuth document (`?ps_auth=1` / `?ps_ov=` or leftover `ps_auth_done`). */
export function isAuthReturnRestorePending(): boolean {
  if (typeof window === "undefined") return false;
  return hasAuthReturnRestoreSignal(
    window.location.href,
    peekAuthReturnDoneCookie()
  );
}

export function markAuthReturnComplete(): void {
  writeAuthCookie(AUTH_RETURN_DONE_COOKIE, AUTH_RETURN_FLAG_VALUE, AUTH_RETURN_DONE_MAX_AGE_SEC);
}

export function peekAuthReturnDoneCookie(): boolean {
  return readAuthCookie(AUTH_RETURN_DONE_COOKIE) === AUTH_RETURN_FLAG_VALUE;
}

export function consumeAuthReturnDoneCookie(): boolean {
  if (!peekAuthReturnDoneCookie()) return false;
  writeAuthCookie(AUTH_RETURN_DONE_COOKIE, "", 0);
  return true;
}

/** Strip `?ps_auth=1` from the address bar and drop the short-lived done cookie. */
export function consumeAuthReturnMarkerInWindow(): boolean {
  if (typeof window === "undefined") return false;
  const { found, nextHref } = consumeAuthReturnMarkerFromHref(window.location.href);
  if (found) {
    window.history.replaceState({}, "", nextHref);
  }
  const cookieFound = consumeAuthReturnDoneCookie();
  return found || cookieFound;
}

export function appendAuthError(path: string, code: string): string {
  const safe = sanitizeAuthReturnPath(path);
  const join = safe.includes("?") ? "&" : "?";
  return `${safe}${join}auth_error=${encodeURIComponent(code)}`;
}

/** Prefer GoTrue error_description / error over opaque no_code. */
export function resolveOAuthCallbackError(searchParams: URLSearchParams): string {
  const description = searchParams.get("error_description")?.trim();
  if (description) return description;
  const error = searchParams.get("error")?.trim();
  if (error) return error;
  return "no_code";
}
