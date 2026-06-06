export const YANDEX_AUTH_SUGGEST_SDK_URL =
  "https://yastatic.net/s3/passport-sdk/autofill/v1/sdk-suggest-with-polyfills-latest.js";

export type YandexAuthSuggestButtonView = "main" | "additional" | "icon" | "iconBG";

export type YandexAuthSuggestInitParams = {
  view: "button";
  parentId: string;
  buttonView?: YandexAuthSuggestButtonView;
  buttonTheme?: "light" | "dark";
  buttonSize?: "xs" | "s" | "m" | "l" | "xl" | "xxl";
  buttonBorderRadius?: number;
  buttonIcon?: "ya" | "yaEng";
};

export type YandexAuthSuggestInitResult = {
  status: "ok" | "error";
  handler?: () => Promise<unknown>;
  code?: string;
};

declare global {
  interface Window {
    YaAuthSuggest?: {
      init: (
        oauthQueryParams: {
          client_id: string;
          response_type: string;
          redirect_uri?: string;
        },
        tokenPageOrigin: string,
        suggestParams?: YandexAuthSuggestInitParams
      ) => Promise<YandexAuthSuggestInitResult>;
    };
  }
}

export function getYandexOAuthClientId(): string | undefined {
  const value = process.env.NEXT_PUBLIC_YANDEX_OAUTH_CLIENT_ID?.trim();
  return value || undefined;
}

export function getYandexOAuthRedirectUri(origin: string): string {
  const fromEnv = process.env.NEXT_PUBLIC_YANDEX_OAUTH_REDIRECT_URI?.trim();
  if (fromEnv) return fromEnv;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (supabaseUrl) {
    return `${supabaseUrl.replace(/\/$/, "")}/auth/v1/callback`;
  }
  return `${origin}/auth/yandex-suggest-token`;
}
