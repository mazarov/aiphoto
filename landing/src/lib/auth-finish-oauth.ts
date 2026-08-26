import { createSupabaseBrowser } from "@/lib/supabase-browser";
import {
  appendAuthError,
  consumeAuthReturnPath,
  markAuthReturnComplete,
  peekAuthReturnPath,
  sanitizeAuthReturnDestination,
} from "@/lib/auth-return-path";
import {
  appendAuthReturnDestination,
  peekAuthReturnOverlay,
  peekAuthReturnScrollY,
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
      : peekAuthReturnPath();
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

/**
 * `@supabase/ssr` `createBrowserClient` forces `detectSessionInUrl` in the
 * browser, so the singleton may consume the PKCE verifier before this finish
 * runs. Those replays look like a missing verifier / invalid flow — not a
 * failed login if a session is already present.
 */
export function isRecoverableOAuthExchangeError(message: string): boolean {
  const text = message.toLowerCase();
  return (
    text.includes("invalid flow state") ||
    text.includes("pkce code verifier not found") ||
    text.includes("code verifier")
  );
}

export function resolveOAuthFinishLocation(input: {
  exchangeError: string | null;
  hasSessionUser: boolean;
  next: string;
  overlay: AuthReturnOverlay | null;
  scrollY?: number | null;
}): { ok: boolean; destination: string } {
  const safeNext = sanitizeAuthReturnDestination(input.next);
  const canRestore =
    !input.exchangeError ||
    input.hasSessionUser;

  if (canRestore) {
    return {
      ok: true,
      destination: appendAuthReturnDestination(
        safeNext,
        input.overlay,
        input.scrollY
      ),
    };
  }

  return {
    ok: false,
    destination: appendAuthError(safeNext, input.exchangeError ?? "oauth_failed"),
  };
}

let inFlight: { code: string; promise: Promise<string> } | null = null;

export function resetOAuthFinishForTests(): void {
  inFlight = null;
}

async function readSessionUser(): Promise<boolean> {
  const supabase = createSupabaseBrowser();
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user) return true;
  try {
    const { data } = await supabase.auth.getUser();
    return Boolean(data.user);
  } catch {
    return false;
  }
}

async function finishOAuthCodeExchangeOnce(
  code: string,
  next: string
): Promise<string> {
  const safeNext = sanitizeAuthReturnDestination(next);
  const overlay = peekAuthReturnOverlay();
  const scrollY = peekAuthReturnScrollY();
  const supabase = createSupabaseBrowser();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  const hasSessionUser = error ? await readSessionUser() : true;
  const result = resolveOAuthFinishLocation({
    exchangeError: error?.message ?? null,
    hasSessionUser,
    next: safeNext,
    overlay,
    scrollY,
  });

  if (result.ok) {
    consumeAuthReturnPath();
    markAuthReturnComplete();
    return result.destination;
  }

  if (error && isRecoverableOAuthExchangeError(error.message)) {
    console.warn("OAuth exchange replay without session:", error.message);
  } else if (error) {
    console.error("OAuth exchange failed:", error.message);
  }
  return result.destination;
}

/**
 * Complete PKCE OAuth in the browser (navigation writer after session cookies).
 * Idempotent: a second call for the same code shares one in-flight promise.
 * Missing verifier / invalid flow + an existing session is success — the
 * browser client may have already exchanged `?code=` via detectSessionInUrl.
 */
export async function finishOAuthCodeExchange(
  code: string,
  next: string
): Promise<string> {
  if (inFlight && inFlight.code === code) {
    return inFlight.promise;
  }
  const promise = finishOAuthCodeExchangeOnce(code, next).finally(() => {
    if (inFlight?.promise === promise) {
      inFlight = null;
    }
  });
  inFlight = { code, promise };
  return promise;
}
