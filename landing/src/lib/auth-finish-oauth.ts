import { createSupabaseBrowser } from "@/lib/supabase-browser";
import {
  AUTH_RETURN_COOKIE,
  AUTH_RETURN_PATH_KEY,
  appendAuthError,
  appendAuthReturnMarker,
  markAuthReturnComplete,
  sanitizeAuthReturnPath,
} from "@/lib/auth-return-path";

function consumeRememberedReturnPath(): string | null {
  let stored: string | null = null;
  try {
    stored = sessionStorage.getItem(AUTH_RETURN_PATH_KEY);
    sessionStorage.removeItem(AUTH_RETURN_PATH_KEY);
  } catch {
    // ignore
  }
  if (typeof document !== "undefined") {
    document.cookie = `${AUTH_RETURN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
  if (!stored) return null;
  return sanitizeAuthReturnPath(stored);
}

/** Resolve post-OAuth destination from `?next=` or remembered return path. */
export function resolveOAuthNextPath(searchParams: URLSearchParams): string {
  if (searchParams.has("next")) {
    return sanitizeAuthReturnPath(searchParams.get("next"));
  }
  return consumeRememberedReturnPath() ?? "/";
}

function clearAuthReturnCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_RETURN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/**
 * Complete PKCE OAuth in the browser (single writer for session cookies).
 * Safe to call again after a successful exchange: invalid flow state + active
 * session is treated as success.
 */
export async function finishOAuthCodeExchange(code: string, next: string): Promise<string> {
  const safeNext = sanitizeAuthReturnPath(next);
  const supabase = createSupabaseBrowser();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (!error) {
    clearAuthReturnCookie();
    markAuthReturnComplete();
    return appendAuthReturnMarker(safeNext);
  }

  // One-time PKCE state: replay after a successful first exchange.
  if (error.message.includes("invalid flow state")) {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      clearAuthReturnCookie();
      markAuthReturnComplete();
      return appendAuthReturnMarker(safeNext);
    }
  }

  console.error("OAuth exchange failed:", error.message);
  return appendAuthError(safeNext, error.message);
}
