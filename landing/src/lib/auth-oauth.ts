import { createSupabaseBrowser } from "@/lib/supabase-browser";
import {
  AUTH_RETURN_COOKIE,
  AUTH_RETURN_PATH_KEY,
  sanitizeAuthReturnPath,
} from "@/lib/auth-return-path";
import { captureBrowserAcquisitionContext } from "@/lib/traffic-source-attribution-browser";

export const YANDEX_OAUTH_PROVIDER = "custom:yandex" as const;
export type OAuthSignInProvider = "google" | typeof YANDEX_OAUTH_PROVIDER;

export {
  AUTH_RETURN_COOKIE,
  AUTH_RETURN_PATH_KEY,
  sanitizeAuthReturnPath,
} from "@/lib/auth-return-path";

export function getCurrentReturnPath(): string {
  if (typeof window === "undefined") return "/";
  return sanitizeAuthReturnPath(
    `${window.location.pathname}${window.location.search}${window.location.hash}`
  );
}

/** Persist return path for callback / client restore after OAuth. */
export function rememberAuthReturnPath(path?: string): string {
  const safe = sanitizeAuthReturnPath(path ?? getCurrentReturnPath());
  try {
    sessionStorage.setItem(AUTH_RETURN_PATH_KEY, safe);
  } catch {
    // ignore
  }
  if (typeof document !== "undefined") {
    const maxAge = 10 * 60;
    document.cookie = `${AUTH_RETURN_COOKIE}=${encodeURIComponent(safe)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
  }
  return safe;
}

export function consumeAuthReturnPath(): string | null {
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
  const safe = sanitizeAuthReturnPath(stored);
  return safe;
}

/**
 * Supabase redirect target. Always go through `/auth/callback` so allowlisted
 * redirect URLs stay stable, and pass the original page as `next`.
 */
export function getOAuthCallbackUrl(): string {
  const next = rememberAuthReturnPath();
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

/** @deprecated use getOAuthCallbackUrl */
export function getOAuthReturnUrl(): string {
  return getOAuthCallbackUrl();
}

/** Extra authorize params so IdP shows account picker on re-login. */
function getOAuthQueryParams(
  provider: OAuthSignInProvider
): Record<string, string> {
  if (provider === YANDEX_OAUTH_PROVIDER) {
    // https://yandex.ru/dev/id/doc/ru/codes/code-url — force account choose + re-consent
    return { force_confirm: "yes" };
  }
  // Google: skip silent reuse of the last account
  return { prompt: "select_account" };
}

export async function signInWithOAuthProvider(provider: OAuthSignInProvider) {
  captureBrowserAcquisitionContext();
  const supabase = createSupabaseBrowser();
  await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: getOAuthCallbackUrl(),
      queryParams: getOAuthQueryParams(provider),
    },
  });
}
