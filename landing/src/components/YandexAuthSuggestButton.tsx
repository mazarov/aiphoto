"use client";

import { useEffect, useId, useRef, useState } from "react";
import Script from "next/script";
import { signInWithOAuthProvider, YANDEX_OAUTH_PROVIDER } from "@/lib/auth-oauth";
import {
  fetchYandexOAuthPublicConfig,
  getYandexOAuthClientId,
  getYandexOAuthRedirectUri,
  YANDEX_AUTH_SUGGEST_SDK_URL,
} from "@/lib/yandex-auth-suggest";

type Props = {
  /** Дополнительная версия — рядом с кнопками других сервисов (рекомендация Яндекса). */
  buttonView?: "additional" | "main";
};

/**
 * Официальная кнопка из конструктора YaAuthSuggest (sdk-suggest.js).
 * Визуал и стили — от Яндекса; клик ведёт в Supabase OAuth (custom:yandex).
 */
export function YandexAuthSuggestButton({ buttonView = "additional" }: Props) {
  const reactId = useId().replace(/:/g, "");
  const containerId = `yandex-auth-suggest-${reactId}`;
  const mountedRef = useRef(true);
  const [clientId, setClientId] = useState<string | undefined>(() =>
    getYandexOAuthClientId()
  );
  const [redirectUriOverride, setRedirectUriOverride] = useState<string | undefined>();
  const [configResolved, setConfigResolved] = useState(() => Boolean(getYandexOAuthClientId()));
  const [sdkReady, setSdkReady] = useState(false);
  const [renderFailed, setRenderFailed] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (clientId) {
      setConfigResolved(true);
      return;
    }

    let cancelled = false;
    void fetchYandexOAuthPublicConfig()
      .then((config) => {
        if (cancelled || !mountedRef.current) return;
        setClientId(config.yandexOAuthClientId);
        setRedirectUriOverride(config.yandexOAuthRedirectUri);
        setConfigResolved(true);
      })
      .catch(() => {
        if (!cancelled && mountedRef.current) setConfigResolved(true);
      });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  useEffect(() => {
    if (!sdkReady || !clientId || typeof window === "undefined") return;

    const origin = window.location.origin;
    const redirectUri = getYandexOAuthRedirectUri(origin, redirectUriOverride);
    const yaAuthSuggest = window.YaAuthSuggest;
    if (!yaAuthSuggest) {
      setRenderFailed(true);
      return;
    }

    let cancelled = false;

    yaAuthSuggest
      .init(
        {
          client_id: clientId,
          response_type: "token",
          redirect_uri: redirectUri,
        },
        origin,
        {
          view: "button",
          parentId: containerId,
          buttonView,
          buttonTheme: "light",
          buttonSize: "m",
          buttonBorderRadius: 12,
          buttonIcon: "ya",
        }
      )
      .then((result) => {
        if (cancelled || !mountedRef.current) return;
        if (result.status !== "ok" || !result.handler) {
          setRenderFailed(true);
          return;
        }

        void result.handler();
        requestAnimationFrame(() => {
          if (cancelled || !mountedRef.current) return;
          if (!hijackOfficialButton(containerId)) {
            setRenderFailed(true);
          }
        });
      })
      .catch(() => {
        if (!cancelled && mountedRef.current) setRenderFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [sdkReady, clientId, redirectUriOverride, containerId, buttonView]);

  if (!configResolved) {
    return <div className="h-11 w-full animate-pulse rounded-xl bg-zinc-100" aria-hidden />;
  }

  if (!clientId) {
    return (
      <button
        type="button"
        onClick={() => signInWithOAuthProvider(YANDEX_OAUTH_PROVIDER)}
        className="flex h-11 w-full items-center justify-center rounded-xl border border-black bg-white text-sm font-medium text-black"
      >
        Яндекс ID
      </button>
    );
  }

  return (
    <>
      <Script
        src={YANDEX_AUTH_SUGGEST_SDK_URL}
        strategy="lazyOnload"
        onLoad={() => setSdkReady(true)}
        onError={() => setRenderFailed(true)}
      />
      <div id={containerId} className="w-full min-h-[44px] [&_.yaPersonalButton]:!w-full" />
      {renderFailed ? (
        <button
          type="button"
          onClick={() => signInWithOAuthProvider(YANDEX_OAUTH_PROVIDER)}
          className="flex h-11 w-full items-center justify-center rounded-xl border border-black bg-white text-sm font-medium text-black"
        >
          Яндекс ID
        </button>
      ) : null}
    </>
  );
}

function hijackOfficialButton(parentId: string): boolean {
  const container = document.getElementById(parentId);
  const button = container?.querySelector(".yaPersonalButton");
  if (!(button instanceof HTMLButtonElement)) return false;

  const clone = button.cloneNode(true);
  if (!(clone instanceof HTMLButtonElement)) return false;

  button.replaceWith(clone);
  clone.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void signInWithOAuthProvider(YANDEX_OAUTH_PROVIDER);
  });
  return true;
}
