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
 * SDK только рисует кнопку; клик всегда идёт в Supabase OAuth (custom:yandex),
 * иначе YaAuthSuggest откроет свой token-flow с чужим redirect_uri.
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
  const [buttonRendered, setButtonRendered] = useState(false);
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
    let observer: MutationObserver | null = null;

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

        const container = document.getElementById(containerId);
        if (!container) {
          setRenderFailed(true);
          return;
        }

        const markRendered = () => {
          if (cancelled || !mountedRef.current) return;
          if (container.querySelector(".yaPersonalButton")) {
            setButtonRendered(true);
            observer?.disconnect();
          }
        };

        observer = new MutationObserver(markRendered);
        observer.observe(container, { childList: true, subtree: true });
        markRendered();

        window.setTimeout(() => {
          if (!cancelled && mountedRef.current && !container.querySelector(".yaPersonalButton")) {
            setRenderFailed(true);
            observer?.disconnect();
          }
        }, 3000);
      })
      .catch(() => {
        if (!cancelled && mountedRef.current) setRenderFailed(true);
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [sdkReady, clientId, redirectUriOverride, containerId, buttonView]);

  const handleSignIn = () => {
    void signInWithOAuthProvider(YANDEX_OAUTH_PROVIDER);
  };

  if (!configResolved) {
    return <div className="h-11 w-full animate-pulse rounded-xl bg-zinc-100" aria-hidden />;
  }

  if (!clientId || renderFailed) {
    return (
      <button
        type="button"
        onClick={handleSignIn}
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
      <div className="relative w-full min-h-[44px]">
        <div
          id={containerId}
          className="pointer-events-none w-full [&_.yaPersonalButton]:!w-full"
          aria-hidden={buttonRendered}
        />
        <button
          type="button"
          aria-label="Войти с Яндекс ID"
          onClick={handleSignIn}
          className="absolute inset-0 z-10 h-full w-full cursor-pointer rounded-xl bg-transparent"
        />
      </div>
    </>
  );
}
