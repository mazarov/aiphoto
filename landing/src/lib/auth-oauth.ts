import { createSupabaseBrowser } from "@/lib/supabase-browser";
import {
  captureAuthReturnScreen,
  rememberAuthReturnScreen,
} from "@/lib/auth-return-screen";
import {
  AUTH_POPUP_WINDOW_NAME,
  buildOAuthPopupWindowFeatures,
  isEmbeddedInAppWebView,
} from "@/lib/auth-popup";
import { captureBrowserAcquisitionContext } from "@/lib/traffic-source-attribution-browser";

export const YANDEX_OAUTH_PROVIDER = "custom:yandex" as const;
export type OAuthSignInProvider = "google" | typeof YANDEX_OAUTH_PROVIDER;

export {
  AUTH_RETURN_COOKIE,
  AUTH_RETURN_PATH_KEY,
  consumeAuthReturnPath,
  sanitizeAuthReturnPath,
} from "@/lib/auth-return-path";

export function getCurrentReturnPath(): string {
  if (typeof window === "undefined") return "/";
  return captureAuthReturnScreen().path;
}

/** Persist return screen (listing + overlay) for callback / client restore after OAuth. */
export function rememberAuthReturnPath(path?: string): string {
  return rememberAuthReturnScreen(path);
}

/**
 * Supabase redirect target. Stable `/auth/callback` only — `next` lives in
 * cookie/sessionStorage. A `?next=` on redirectTo is often stripped or
 * rejected by GoTrue, which then falls back to SITE_URL `/`.
 */
export function getOAuthCallbackUrl(): string {
  rememberAuthReturnPath();
  return `${window.location.origin}/auth/callback`;
}

/** @deprecated use getOAuthReturnUrl */
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

export type PopupOrRedirectSignInResult =
  | { mode: "popup"; popup: Window }
  | { mode: "redirect" };

/**
 * Attempt OAuth inside a centered popup so the generation control keeps its
 * in-memory state (`data:` selfie, prompt, picked example) without page reload.
 * Automatically falls back to top-level redirect if popups are blocked or in WebViews.
 */
export async function signInWithOAuthPopupOrRedirect(
  provider: OAuthSignInProvider,
): Promise<PopupOrRedirectSignInResult> {
  captureBrowserAcquisitionContext();

  if (
    typeof window === "undefined" ||
    isEmbeddedInAppWebView(window.navigator?.userAgent)
  ) {
    await signInWithOAuthProvider(provider);
    return { mode: "redirect" };
  }

  const features = buildOAuthPopupWindowFeatures(
    window.screen as {
      width?: number;
      height?: number;
      availLeft?: number;
      availTop?: number;
    },
  );
  let popup: Window | null = null;
  try {
    popup = window.open("about:blank", AUTH_POPUP_WINDOW_NAME, features);
  } catch {
    popup = null;
  }

  if (!popup) {
    await signInWithOAuthProvider(provider);
    return { mode: "redirect" };
  }

  try {
    popup.focus?.();
  } catch {
    /* ignore */
  }

  const supabase = createSupabaseBrowser();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: getOAuthCallbackUrl(),
      queryParams: getOAuthQueryParams(provider),
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    try {
      popup.close();
    } catch {
      /* ignore */
    }
    await signInWithOAuthProvider(provider);
    return { mode: "redirect" };
  }

  popup.location.replace(data.url);
  return { mode: "popup", popup };
}
