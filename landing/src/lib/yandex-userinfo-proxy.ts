const YANDEX_USERINFO_JSON = "https://login.yandex.ru/info?format=json";
const YANDEX_USERINFO_JWT = "https://login.yandex.ru/info?format=jwt";

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

function buildYandexUserinfoUrl(base: string, accessToken: string, useQueryToken: boolean): string {
  if (!useQueryToken) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}oauth_token=${encodeURIComponent(accessToken)}`;
}

async function requestYandexJson(
  accessToken: string,
  useQueryToken: boolean,
): Promise<YandexUserinfoResponse> {
  const url = buildYandexUserinfoUrl(YANDEX_USERINFO_JSON, accessToken, useQueryToken);
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

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const parts = jwt.trim().split(".");
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(base64, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function requestYandexJwt(accessToken: string): Promise<YandexUserinfoResponse> {
  const res = await fetch(YANDEX_USERINFO_JWT, {
    headers: { Authorization: `OAuth ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return {};

  const jwt = await res.text();
  const payload = decodeJwtPayload(jwt);
  if (!payload) return {};

  const email =
    (typeof payload.email === "string" && payload.email) ||
    (typeof payload.default_email === "string" && payload.default_email) ||
    undefined;

  return {
    id: typeof payload.id === "string" || typeof payload.id === "number" ? payload.id : undefined,
    login: typeof payload.login === "string" ? payload.login : undefined,
    default_email: email,
    real_name: typeof payload.real_name === "string" ? payload.real_name : undefined,
    display_name: typeof payload.display_name === "string" ? payload.display_name : undefined,
    default_avatar_id:
      typeof payload.default_avatar_id === "string" ? payload.default_avatar_id : undefined,
  };
}

/** Yandex may omit default_email on repeat logins when login:email scope is not re-granted. */
export function resolveYandexEmail(data: YandexUserinfoResponse): string {
  const direct = data.default_email?.trim() || data.emails?.[0]?.trim();
  if (direct) return direct;

  const login = data.login?.trim();
  if (login) return `${login}@yandex.ru`;

  return "";
}

export async function fetchYandexUserinfo(accessToken: string): Promise<YandexUserinfoResponse> {
  let data: YandexUserinfoResponse;
  try {
    data = await requestYandexJson(accessToken, false);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (!message.startsWith("yandex_userinfo_401")) {
      throw err;
    }
    data = await requestYandexJson(accessToken, true);
  }

  if (!resolveYandexEmail(data)) {
    const jwtData = await requestYandexJwt(accessToken);
    data = {
      ...jwtData,
      ...data,
      default_email: data.default_email || jwtData.default_email,
      emails: data.emails?.length ? data.emails : jwtData.emails,
      login: data.login || jwtData.login,
      id: data.id ?? jwtData.id,
      real_name: data.real_name || jwtData.real_name,
      display_name: data.display_name || jwtData.display_name,
      default_avatar_id: data.default_avatar_id || jwtData.default_avatar_id,
    };
  }

  return data;
}

/** Normalize Yandex profile to OAuth/OIDC-style claims expected by GoTrue custom OAuth. */
export function mapYandexUserinfoToOAuthClaims(data: YandexUserinfoResponse): YandexOAuthClaims {
  const email = resolveYandexEmail(data);
  const subject = data.id != null ? String(data.id) : data.login?.trim() || "";
  const avatarId = data.default_avatar_id?.trim();
  const name = data.real_name?.trim() || data.display_name?.trim() || undefined;

  if (!subject) {
    throw new Error("yandex_subject_missing");
  }
  if (!email) {
    throw new Error("yandex_email_missing");
  }

  const claims: YandexOAuthClaims = {
    sub: subject,
    id: subject,
    email,
    email_verified: true,
  };

  if (name) claims.name = name;
  if (avatarId) {
    claims.picture = `https://avatars.yandex.net/get-yapic/${avatarId}/islands-200`;
  }

  return claims;
}
