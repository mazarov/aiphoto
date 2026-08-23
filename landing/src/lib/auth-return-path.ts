/** Cookie + sessionStorage key for post-OAuth return path. */
export const AUTH_RETURN_PATH_KEY = "promptshot:auth-return-path";
export const AUTH_RETURN_COOKIE = "ps_auth_next";

/** One-shot query + cookie so the return document is not the pre-login bfcache entry. */
export const AUTH_RETURN_FLAG = "ps_auth";
export const AUTH_RETURN_FLAG_VALUE = "1";
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
    url.searchParams.delete(AUTH_RETURN_FLAG);
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
export function appendAuthReturnMarker(path: string): string {
  const safe = sanitizeAuthReturnPath(path);
  try {
    const url = new URL(safe, "https://promptshot.local");
    url.searchParams.set(AUTH_RETURN_FLAG, AUTH_RETURN_FLAG_VALUE);
    return pathFromLocalUrl(url);
  } catch {
    return safe;
  }
}

export function consumeAuthReturnMarkerFromHref(href: string): {
  found: boolean;
  nextHref: string;
} {
  try {
    const url = new URL(href, "https://promptshot.local");
    const found = url.searchParams.get(AUTH_RETURN_FLAG) === AUTH_RETURN_FLAG_VALUE;
    if (!found) {
      return { found: false, nextHref: `${url.pathname}${url.search}${url.hash}` };
    }
    url.searchParams.delete(AUTH_RETURN_FLAG);
    return { found: true, nextHref: pathFromLocalUrl(url) };
  } catch {
    return { found: false, nextHref: "/" };
  }
}

function writeAuthCookie(name: string, value: string, maxAgeSec: number): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax`;
}

function readAuthCookie(name: string): string | null {
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
