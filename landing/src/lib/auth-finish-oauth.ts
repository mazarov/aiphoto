import { createSupabaseBrowser } from "@/lib/supabase-browser";
import {
  AUTH_RETURN_COOKIE,
  appendAuthError,
  appendAuthReturnMarker,
  consumeAuthReturnPath,
  markAuthReturnComplete,
  sanitizeAuthReturnDestination,
} from "@/lib/auth-return-path";
import {
  peekAuthReturnOverlay,
  preferListingPathOverOverlayNext,
  type AuthReturnOverlay,
} from "@/lib/auth-return-screen";

/** Resolve post-OAuth destination from `?next=` or remembered return path. */
export function resolveOAuthNextPath(
  searchParams: URLSearchParams,
  options?: {
    rememberedPath?: string | null;
    overlay?: AuthReturnOverlay | null;
  }
): string {
  const fromQuery = searchParams.has("next")
    ? sanitizeAuthReturnDestination(searchParams.get("next"))
    : null;
  const remembered =
    options && "rememberedPath" in options
      ? options.rememberedPath
        ? sanitizeAuthReturnDestination(options.rememberedPath)
        : null
      : consumeAuthReturnPath();
  const overlay =
    options && "overlay" in options
      ? options.overlay ?? null
      : peekAuthReturnOverlay();

  return preferListingPathOverOverlayNext({
    fromQuery,
    rememberedPath: remembered,
    overlay,
  });
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
  const safeNext = sanitizeAuthReturnDestination(next);
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
