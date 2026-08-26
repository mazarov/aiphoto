"use client";

import { useEffect, useRef, useState } from "react";
import {
  finishOAuthCodeExchange,
  resolveOAuthNextPath,
} from "@/lib/auth-finish-oauth";
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

    if (!code) {
      // GoTrue often redirects with error= / error_description= and no code
      // (e.g. signup trigger failure). Surface that instead of opaque no_code.
      window.location.replace(
        appendAuthError(next, resolveOAuthCallbackError(url.searchParams))
      );
      return;
    }

    void finishOAuthCodeExchange(code, next)
      .then((destination) => {
        window.location.replace(destination);
      })
      .catch((err: unknown) => {
        const text = err instanceof Error ? err.message : "oauth_failed";
        console.error("OAuth callback failed:", text);
        setMessage("Не удалось войти");
        window.location.replace(appendAuthError(next, text));
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
