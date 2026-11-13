export const AUTH_POPUP_WINDOW_NAME = "promptshot_oauth_popup";
export const AUTH_POPUP_CHANNEL_NAME = "promptshot:auth-popup";
export const AUTH_POPUP_MESSAGE_TYPE = "PROMPTSHOT_AUTH_COMPLETE";

export type AuthPopupCompletionMessage = {
  type: typeof AUTH_POPUP_MESSAGE_TYPE;
  ok: boolean;
  error: string | null;
};

/**
 * In-app social/messenger WebViews often trap `window.open` popups without a
 * close control or isolate popup cookies. Prefer top-level redirect there.
 */
export function isEmbeddedInAppWebView(userAgent: string | null | undefined): boolean {
  const ua = (userAgent || "").trim();
  if (!ua) return false;
  return /Telegram|VKClient|Instagram|FBAN|FBAV|Line\/|MicroMessenger|; wv\)/i.test(
    ua,
  );
}

export function isOAuthPopupWindow(
  win?: { name?: string; opener?: unknown } | null,
  searchParams?: URLSearchParams | null,
): boolean {
  if (searchParams?.get("popup") === "1") return true;
  if (!win) return false;
  if (win.name === AUTH_POPUP_WINDOW_NAME) return true;
  return Boolean(win.opener && win.opener !== win);
}

export function buildOAuthPopupWindowFeatures(screenGeom?: {
  width?: number;
  height?: number;
  availLeft?: number;
  availTop?: number;
}): string {
  const popupWidth = 500;
  const popupHeight = 640;
  const screenW = screenGeom?.width ?? 1280;
  const screenH = screenGeom?.height ?? 800;
  const offsetLeft = screenGeom?.availLeft ?? 0;
  const offsetTop = screenGeom?.availTop ?? 0;
  const left = Math.max(0, Math.round(offsetLeft + (screenW - popupWidth) / 2));
  const top = Math.max(0, Math.round(offsetTop + (screenH - popupHeight) / 2));
  return `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=yes,scrollbars=yes`;
}

export function isAuthPopupCompletionMessage(
  data: unknown,
): data is AuthPopupCompletionMessage {
  if (!data || typeof data !== "object") return false;
  const candidate = data as Partial<AuthPopupCompletionMessage>;
  return (
    candidate.type === AUTH_POPUP_MESSAGE_TYPE &&
    typeof candidate.ok === "boolean"
  );
}

/**
 * Notify the opener tab that PKCE code exchange finished.
 * Uses BroadcastChannel first (survives IdP Cross-Origin-Opener-Policy headers
 * that null `window.opener`), plus `window.opener.postMessage` as backup.
 */
export function notifyOAuthPopupComplete(input: {
  ok: boolean;
  error?: string | null;
}): void {
  const message: AuthPopupCompletionMessage = {
    type: AUTH_POPUP_MESSAGE_TYPE,
    ok: input.ok,
    error: input.error ?? null,
  };

  if (typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel(AUTH_POPUP_CHANNEL_NAME);
      channel.postMessage(message);
      channel.close();
    } catch {
      /* ignore */
    }
  }

  if (typeof window !== "undefined") {
    try {
      const opener = window.opener as Window | null | undefined;
      if (opener && opener !== window) {
        opener.postMessage(message, window.location.origin);
      }
    } catch {
      /* cross-origin or COOP-isolated opener */
    }
  }
}
