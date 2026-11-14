"use client";

import { useEffect, useRef, useState } from "react";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import { ANALYZE_QUOTA_AUTH_SUBTITLE } from "@/lib/foto-v-promt-copy";
import {
  signInWithOAuthPopupOrRedirect,
  YANDEX_OAUTH_PROVIDER,
  type OAuthSignInProvider,
} from "@/lib/auth-oauth";
import {
  AUTH_POPUP_CHANNEL_NAME,
  isAuthPopupCompletionMessage,
} from "@/lib/auth-popup";

export type ComposeAuthSheetReason = "default" | "analyze_quota";

export type ComposeAuthSheetProps = {
  isDock: boolean;
  isMobile: boolean;
  inFlowDock?: boolean;
  reason?: ComposeAuthSheetReason;
  onBeforeRedirect?: () => void;
  onClose: () => void;
};

export const COMPOSE_AUTH_DEFAULT_SUBTITLE =
  "Войдите, чтобы запустить генерацию — выбранные фото, стиль и промт сохранятся.";

export function ComposeAuthSheet({
  isDock,
  isMobile,
  inFlowDock = false,
  reason = "default",
  onBeforeRedirect,
  onClose,
}: ComposeAuthSheetProps) {
  const [busyProvider, setBusyProvider] = useState<OAuthSignInProvider | null>(
    null,
  );
  const [authError, setAuthError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);

  useEffect(() => {
    const handleCompletion = (data: unknown) => {
      if (!isAuthPopupCompletionMessage(data)) return;
      popupRef.current = null;
      setBusyProvider(null);
      if (!data.ok) {
        setAuthError("Не удалось завершить вход. Попробуйте ещё раз.");
      }
    };

    const onWindowMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      handleCompletion(event.data);
    };

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      try {
        channel = new BroadcastChannel(AUTH_POPUP_CHANNEL_NAME);
        channel.onmessage = (event: MessageEvent) =>
          handleCompletion(event.data);
      } catch {
        channel = null;
      }
    }

    window.addEventListener("message", onWindowMessage);
    return () => {
      channel?.close();
      window.removeEventListener("message", onWindowMessage);
    };
  }, []);

  useEffect(() => {
    if (!busyProvider) return;
    const timer = window.setInterval(() => {
      const popup = popupRef.current;
      if (popup && popup.closed) {
        popupRef.current = null;
        setBusyProvider(null);
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [busyProvider]);

  const handleSignIn = async (provider: OAuthSignInProvider) => {
    if (busyProvider) return;
    setAuthError(null);
    onBeforeRedirect?.();
    setBusyProvider(provider);
    try {
      const result = await signInWithOAuthPopupOrRedirect(provider);
      if (result.mode === "popup") {
        popupRef.current = result.popup;
      }
    } catch {
      popupRef.current = null;
      setBusyProvider(null);
      setAuthError("Не удалось открыть окно входа. Попробуйте ещё раз.");
    }
  };

  const subtitle =
    reason === "analyze_quota"
      ? ANALYZE_QUOTA_AUTH_SUBTITLE
      : COMPOSE_AUTH_DEFAULT_SUBTITLE;

  const btnClass = isDock
    ? `${OVERLAY_BUTTON_UA_RESET} flex min-h-12 w-full items-center justify-center gap-2.5 rounded-2xl bg-white px-4 py-3 text-[13px] font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-100 active:scale-[0.99] disabled:opacity-60`
    : `${OVERLAY_BUTTON_UA_RESET} flex min-h-12 w-full items-center justify-center gap-2.5 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[13px] font-semibold text-zinc-800 transition hover:border-zinc-300 hover:bg-zinc-50 active:scale-[0.99] disabled:opacity-60`;

  const buttonsGrid = (
    <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
      <button
        type="button"
        disabled={busyProvider !== null}
        onClick={() => void handleSignIn("google")}
        className={btnClass}
      >
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center"
          aria-hidden
        >
          <GoogleGlyph />
        </span>
        <span className="truncate">
          {busyProvider === "google"
            ? "Открываем Google…"
            : "Войти через Google"}
        </span>
      </button>

      <button
        type="button"
        disabled={busyProvider !== null}
        onClick={() => void handleSignIn(YANDEX_OAUTH_PROVIDER)}
        className={btnClass}
      >
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center"
          aria-hidden
        >
          <YandexGlyph />
        </span>
        <span className="truncate">
          {busyProvider === YANDEX_OAUTH_PROVIDER
            ? "Открываем Яндекс…"
            : "Войти через Яндекс"}
        </span>
      </button>
    </div>
  );

  if (inFlowDock) {
    return (
      <div
        id="inline-generation-auth"
        role="region"
        aria-label="Вход для генерации"
        className="flex w-full flex-col gap-3 text-zinc-100"
      >
        <div className="flex items-center justify-between gap-3 pl-0.5">
          <p className="text-[13px] font-medium leading-snug text-white/80">
            {subtitle}
          </p>
          <button
            type="button"
            aria-label="Свернуть вход"
            onClick={onClose}
            className={`${OVERLAY_BUTTON_UA_RESET} flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/75 transition hover:bg-white/15 hover:text-white active:scale-95`}
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m6 9 6 6 6-6"
              />
            </svg>
          </button>
        </div>

        {buttonsGrid}

        {authError ? (
          <p role="status" className="text-[13px] font-medium text-rose-200">
            {authError}
          </p>
        ) : null}
      </div>
    );
  }

  const standaloneClass = isMobile
    ? "absolute inset-0 z-50 flex h-full min-h-0 flex-col justify-end bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-zinc-900"
    : "absolute inset-x-0 bottom-0 z-50 flex flex-col rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-zinc-900 shadow-[0_-20px_60px_-24px_rgba(0,0,0,0.45)]";

  return (
    <div
      id="inline-generation-auth"
      role="dialog"
      aria-modal="true"
      aria-label="Вход для генерации"
      className={standaloneClass}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="pt-1 text-[13px] font-medium leading-relaxed text-zinc-600">
          {subtitle}
        </p>
        <button
          type="button"
          aria-label="Закрыть вход"
          onClick={onClose}
          className={`${OVERLAY_BUTTON_UA_RESET} flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition hover:bg-zinc-200`}
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            aria-hidden
          >
            <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {buttonsGrid}

      {authError ? (
        <p role="status" className="mt-2.5 text-[13px] font-medium text-rose-600">
          {authError}
        </p>
      ) : null}
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function YandexGlyph() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#FC3F1D" />
      <path
        fill="#fff"
        d="M13.32 18.4h-2.14V12.55L7.9 5.6h2.28l1.88 5.2c.18.52.35 1.05.48 1.58h.06c.13-.53.31-1.06.48-1.58L14.96 5.6h2.24l-3.28 6.95V18.4z"
      />
    </svg>
  );
}
