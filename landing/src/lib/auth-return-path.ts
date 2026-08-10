/** Cookie + sessionStorage key for post-OAuth return path. */
export const AUTH_RETURN_PATH_KEY = "promptshot:auth-return-path";
export const AUTH_RETURN_COOKIE = "ps_auth_next";

/** Same-origin relative path only (`/pricing?test=true`). */
export function sanitizeAuthReturnPath(raw: string | null | undefined): string {
  if (!raw) return "/";
  const path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
    return "/";
  }
  return path;
}

export function appendAuthError(path: string, code: string): string {
  const safe = sanitizeAuthReturnPath(path);
  const join = safe.includes("?") ? "&" : "?";
  return `${safe}${join}auth_error=${encodeURIComponent(code)}`;
}
