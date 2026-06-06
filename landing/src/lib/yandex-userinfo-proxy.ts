const YANDEX_USERINFO_URL = "https://login.yandex.ru/info?format=json";

export type YandexUserinfoResponse = {
  id?: string | number;
  login?: string;
  default_email?: string;
  emails?: string[];
  real_name?: string;
  display_name?: string;
  default_avatar_id?: string;
};

/** Public URL GoTrue should use as custom:yandex userinfo_url. */
export function getYandexUserinfoProxyUrl(siteOrigin: string): string {
  return `${siteOrigin.replace(/\/$/, "")}/api/auth/yandex-userinfo`;
}

export function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function fetchYandexUserinfo(accessToken: string): Promise<YandexUserinfoResponse> {
  const res = await fetch(YANDEX_USERINFO_URL, {
    headers: {
      Authorization: `OAuth ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`yandex_userinfo_${res.status}:${body.slice(0, 200)}`);
  }

  return (await res.json()) as YandexUserinfoResponse;
}

/** Normalize Yandex profile to OAuth/OIDC-style claims expected by GoTrue custom OAuth. */
export function mapYandexUserinfoToOAuthClaims(data: YandexUserinfoResponse) {
  const email = data.default_email?.trim() || data.emails?.[0]?.trim() || "";
  const subject = data.id != null ? String(data.id) : data.login?.trim() || "";
  const avatarId = data.default_avatar_id?.trim();

  return {
    sub: subject,
    email,
    email_verified: email ? true : false,
    name: data.real_name?.trim() || data.display_name?.trim() || undefined,
    picture: avatarId
      ? `https://avatars.yandex.net/get-yapic/${avatarId}/islands-200`
      : undefined,
    default_avatar_id: avatarId,
    real_name: data.real_name?.trim() || undefined,
    display_name: data.display_name?.trim() || undefined,
    login: data.login?.trim() || undefined,
  };
}
