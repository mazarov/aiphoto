"use client";

import { useEffect, useRef, useState } from "react";
import {
  finishOAuthCodeExchange,
  resolveOAuthNextPath,
} from "@/lib/auth-finish-oauth";
import {
  isOAuthPopupWindow,
  notifyOAuthPopupComplete,
} from "@/lib/auth-popup";
import {
  appendAuthError,
  resolveOAuthCallbackError,
} from "@/lib/auth-return-path";

/**
 * Browser-side OAuth finish (navigation writer). The SSR browser singleton may
 * already have exchanged `?code=` via detectSessionInUrl; finish is idempotent
 * and must not send a logged-in user to `/?auth_error=`.
 */
export default function AuthCallbackPage() {
  const startedRef = useRef(false);
  const [message, setMessage] = useState("Входим…");

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const next = resolveOAuthNextPath(url.searchParams);
    const inPopup = isOAuthPopupWindow(window, url.searchParams);

    const closePopupOrRedirect = (destination: string) => {
      try {
        window.close();
      } catch {
        /* ignore */
      }
      window.setTimeout(() => {
        if (!window.closed) {
          window.location.replace(destination);
        }
      }, 400);
    };

    if (!code) {
      const errCode = resolveOAuthCallbackError(url.searchParams);
      const destination = appendAuthError(next, errCode);
      if (inPopup) {
        notifyOAuthPopupComplete({ ok: false, error: errCode });
        closePopupOrRedirect(destination);
        return;
      }
      window.location.replace(destination);
      return;
    }

    void finishOAuthCodeExchange(code, next)
      .then((destination) => {
        if (inPopup) {
          const failed = destination.includes("auth_error=");
          notifyOAuthPopupComplete({
            ok: !failed,
            error: failed ? "oauth_failed" : null,
          });
          setMessage(failed ? "Не удалось войти" : "Готово, возвращаемся…");
          closePopupOrRedirect(destination);
          return;
        }
        window.location.replace(destination);
      })
      .catch((err: unknown) => {
        const text = err instanceof Error ? err.message : "oauth_failed";
        console.error("OAuth callback failed:", text);
        setMessage("Не удалось войти");
        const destination = appendAuthError(next, text);
        if (inPopup) {
          notifyOAuthPopupComplete({ ok: false, error: text });
          closePopupOrRedirect(destination);
          return;
        }
        window.location.replace(destination);
      });
  }, []);

  return (
    <main className="flex min-h-[50vh] items-center justify-center px-4">
      <p className="text-sm text-zinc-500" aria-live="polite">
        {message}
      </p>
    </main>
  );
}
