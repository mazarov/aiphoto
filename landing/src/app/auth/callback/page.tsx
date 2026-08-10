"use client";

import { useEffect, useRef, useState } from "react";
import {
  finishOAuthCodeExchange,
  resolveOAuthNextPath,
} from "@/lib/auth-finish-oauth";
import { appendAuthError } from "@/lib/auth-return-path";

/**
 * Browser-side OAuth finish. Server route exchange caused duplicate POST /token
 * (200 then flow_state_not_found) and auth_error redirects without session cookies.
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
      window.location.replace(appendAuthError(next, "no_code"));
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
