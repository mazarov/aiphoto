const YANDEX_USERINFO_BASE = "https://login.yandex.ru/info?format=json";

export type YandexUserinfoResponse = {
  id?: string | number;
  login?: string;
  default_email?: string;
  emails?: string[];
  real_name?: string;
  display_name?: string;
  default_avatar_id?: string;
};

export type YandexOAuthClaims = {
  sub: string;
  id: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
};

/** Public URL GoTrue should use as custom:yandex userinfo_url (landing). */
export function getYandexUserinfoProxyUrl(siteOrigin: string): string {
  return `${siteOrigin.replace(/\/$/, "")}/api/auth/yandex-userinfo`;
}

/** Same-host option if auth cannot reach promptshot.ru (standalone on Supabase stack). */
export function getYandexUserinfoStandaloneUrl(supabasePublicUrl: string): string {
  return `${supabasePublicUrl.replace(/\/$/, "")}/yandex-userinfo`;
}

export function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function buildYandexUserinfoUrl(accessToken: string, useQueryToken: boolean): string {
  if (!useQueryToken) return YANDEX_USERINFO_BASE;
  return `${YANDEX_USERINFO_BASE}&oauth_token=${encodeURIComponent(accessToken)}`;
}

async function requestYandexUserinfo(
  accessToken: string,
  useQueryToken: boolean,
): Promise<YandexUserinfoResponse> {
  const url = buildYandexUserinfoUrl(accessToken, useQueryToken);
  const headers: HeadersInit = useQueryToken
    ? {}
    : { Authorization: `OAuth ${accessToken}` };

  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`yandex_userinfo_${res.status}:${body.slice(0, 200)}`);
  }

  return (await res.json()) as YandexUserinfoResponse;
}

export async function fetchYandexUserinfo(accessToken: string): Promise<YandexUserinfoResponse> {
  try {
    return await requestYandexUserinfo(accessToken, false);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (!message.startsWith("yandex_userinfo_401")) {
      throw err;
    }
    return requestYandexUserinfo(accessToken, true);
  }
}

/** Normalize Yandex profile to OAuth/OIDC-style claims expected by GoTrue custom OAuth. */
export function mapYandexUserinfoToOAuthClaims(data: YandexUserinfoResponse): YandexOAuthClaims {
  const email = data.default_email?.trim() || data.emails?.[0]?.trim() || "";
  const subject = data.id != null ? String(data.id) : data.login?.trim() || "";
  const avatarId = data.default_avatar_id?.trim();
  const name = data.real_name?.trim() || data.display_name?.trim() || undefined;

  if (!subject) {
    throw new Error("yandex_subject_missing");
  }

  const claims: YandexOAuthClaims = {
    sub: subject,
    id: subject,
    email,
    email_verified: Boolean(email),
  };

  if (name) claims.name = name;
  if (avatarId) {
    claims.picture = `https://avatars.yandex.net/get-yapic/${avatarId}/islands-200`;
  }

  return claims;
}
