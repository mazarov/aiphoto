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
  // Drop prior auth_error so retries don't accumulate ?auth_error=&auth_error=
  try {
    const url = new URL(path, "https://promptshot.local");
    url.searchParams.delete("auth_error");
    const search = url.searchParams.toString();
    return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
  } catch {
    return path;
  }
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
