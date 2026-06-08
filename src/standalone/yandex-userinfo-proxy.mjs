#!/usr/bin/env node
/**
 * Standalone Yandex userinfo adapter for GoTrue custom:yandex.
 * Run on the same Dockhost stack as Supabase auth if auth cannot reach promptshot.ru.
 *
 * Expose via Kong (or reverse proxy) at:
 *   https://<SUPABASE_HOST>/yandex-userinfo
 *
 * Then set custom provider userinfo_url to that URL.
 *
 * Usage:
 *   PORT=3099 node yandex-userinfo-proxy.mjs
 */

import http from "node:http";

const PORT = Number(process.env.PORT || 3099);
const YANDEX_USERINFO_JSON = "https://login.yandex.ru/info?format=json";
const YANDEX_USERINFO_JWT = "https://login.yandex.ru/info?format=jwt";

function extractBearerToken(header) {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function resolveEmail(data) {
  const direct = (data.default_email || data.emails?.[0] || "").trim();
  if (direct) return direct;
  const login = (data.login || "").trim();
  if (login) return `${login}@yandex.ru`;
  return "";
}

function decodeJwtPayload(jwt) {
  const parts = jwt.trim().split(".");
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

async function fetchYandexJson(accessToken, useQueryToken) {
  const url = useQueryToken
    ? `${YANDEX_USERINFO_JSON}&oauth_token=${encodeURIComponent(accessToken)}`
    : YANDEX_USERINFO_JSON;
  const headers = useQueryToken ? {} : { Authorization: `OAuth ${accessToken}` };
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`yandex_${res.status}:${body.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchYandexJwt(accessToken) {
  const res = await fetch(YANDEX_USERINFO_JWT, {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  if (!res.ok) return {};
  const payload = decodeJwtPayload(await res.text());
  if (!payload) return {};
  return {
    id: payload.id,
    login: payload.login,
    default_email: payload.email || payload.default_email,
    real_name: payload.real_name,
    display_name: payload.display_name,
    default_avatar_id: payload.default_avatar_id,
  };
}

async function fetchYandexProfile(accessToken) {
  let data;
  try {
    data = await fetchYandexJson(accessToken, false);
  } catch (err) {
    if (!String(err.message || err).includes("yandex_401")) throw err;
    data = await fetchYandexJson(accessToken, true);
  }

  if (!resolveEmail(data)) {
    const jwtData = await fetchYandexJwt(accessToken);
    data = {
      ...jwtData,
      ...data,
      default_email: data.default_email || jwtData.default_email,
      login: data.login || jwtData.login,
      id: data.id ?? jwtData.id,
      real_name: data.real_name || jwtData.real_name,
      display_name: data.display_name || jwtData.display_name,
      default_avatar_id: data.default_avatar_id || jwtData.default_avatar_id,
    };
  }

  return data;
}

function mapClaims(data) {
  const email = resolveEmail(data);
  const subject = data.id != null ? String(data.id) : (data.login || "").trim();
  const avatarId = (data.default_avatar_id || "").trim();
  const name = (data.real_name || data.display_name || "").trim();

  if (!subject) throw new Error("yandex_subject_missing");
  if (!email) throw new Error("yandex_email_missing");

  const claims = { sub: subject, id: subject, email, email_verified: true };
  if (name) claims.name = name;
  if (avatarId) {
    claims.picture = `https://avatars.yandex.net/get-yapic/${avatarId}/islands-200`;
  }
  return claims;
}

const server = http.createServer(async (req, res) => {
  if (req.method !== "GET") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "method_not_allowed" }));
    return;
  }

  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "missing_bearer_token" }));
    return;
  }

  try {
    const claims = mapClaims(await fetchYandexProfile(token));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(claims));
  } catch (err) {
    const message = String(err.message || err);
    const status =
      message.includes("subject_missing") || message.includes("email_missing") ? 422 : 502;
    console.error("[yandex-userinfo-standalone]", message);
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: message }));
  }
});

server.listen(PORT, () => {
  console.log(`yandex-userinfo-proxy listening on :${PORT}`);
});
