/**
 * Shared helpers for Yandex SEO MCP servers (Webmaster + Metrica).
 * Zero npm deps — Node 20+.
 *
 * Logs go to stderr only — stdout is MCP JSON-RPC.
 */
import { existsSync, readFileSync } from "node:fs";
import readline from "node:readline";

export const PROTOCOL_VERSIONS = ["2024-11-05", "2025-03-26", "2025-06-18"];

const WEBMASTER_BASE = "https://api.webmaster.yandex.net/v4";
const METRIKA_BASE = "https://api-metrika.yandex.net";

export function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const eq = line.indexOf("=");
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

export function getSeoToken() {
  return (
    process.env.YANDEX_SEO_TOKEN ||
    process.env.YANDEX_WEBMASTER_TOKEN ||
    process.env.YANDEX_METRIKA_TOKEN ||
    ""
  ).trim();
}

export function textResult(text, isError = false) {
  return {
    content: [{ type: "text", text }],
    isError,
  };
}

export function jsonResult(payload, isError = false) {
  return textResult(JSON.stringify(payload, null, 2), isError);
}

export function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export function toYmd(date) {
  return date.toISOString().slice(0, 10);
}

export function dateRange(days, fallback = 28) {
  const span = clampInt(days, 1, 90, fallback);
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (span - 1));
  return {
    days: span,
    date_from: toYmd(from),
    date_to: toYmd(to),
  };
}

function sanitizeApiError(data) {
  if (data == null) return null;
  if (typeof data !== "object") return { message: String(data).slice(0, 500) };
  const out = {};
  for (const key of [
    "error_code",
    "error_message",
    "message",
    "code",
    "errors",
    "available_user_id",
    "host_id",
  ]) {
    if (data[key] != null) out[key] = data[key];
  }
  return Object.keys(out).length > 0 ? out : { message: "Yandex API error" };
}

export async function yandexFetch(url, { method = "GET", body } = {}) {
  const token = getSeoToken();
  if (!token) {
    const err = new Error(
      "Missing YANDEX_SEO_TOKEN. Copy .cursor/yandex-seo.env.example to .cursor/yandex-seo.env and add an OAuth token.",
    );
    err.code = "NO_TOKEN";
    throw err;
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 25_000);
  try {
    const headers = {
      Authorization: `OAuth ${token}`,
      Accept: "application/json",
    };
    if (body != null) {
      headers["Content-Type"] = "application/json; charset=UTF-8";
    }
    const res = await fetch(url, {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
      signal: ac.signal,
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text.slice(0, 2000) };
    }
    if (!res.ok) {
      const err = new Error(
        res.status === 429
          ? "Yandex API quota exceeded (429). Wait and retry later."
          : `Yandex API ${res.status}`,
      );
      err.status = res.status;
      err.payload = sanitizeApiError(data);
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export function webmasterUrl(path, query) {
  const url = new URL(`${WEBMASTER_BASE}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value == null) continue;
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, String(item));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

export function metrikaUrl(path, query) {
  const url = new URL(`${METRIKA_BASE}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value == null) continue;
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, String(item));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

export function hostnameOf(input) {
  try {
    const raw = String(input || "").trim();
    if (!raw) return "";
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

export async function resolveWebmasterHost() {
  const user = await yandexFetch(webmasterUrl("/user"));
  const userId = user?.user_id;
  if (userId == null) {
    throw new Error("Webmaster /user did not return user_id");
  }
  const wanted = hostnameOf(
    process.env.YANDEX_WEBMASTER_HOST_URL || "https://promptshot.ru",
  );
  const payload = await yandexFetch(webmasterUrl(`/user/${userId}/hosts`));
  const hosts = Array.isArray(payload?.hosts) ? payload.hosts : [];
  const match =
    hosts.find((host) => {
      const hay = [
        host.host_id,
        host.ascii_host_url,
        host.unicode_host_url,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return wanted && hay.includes(wanted);
    }) ||
    hosts.find((host) => host.verified) ||
    hosts[0];
  if (!match?.host_id) {
    throw new Error(
      wanted
        ? `No Webmaster host matching ${wanted}`
        : "No Webmaster hosts on this token",
    );
  }
  return { userId, host: match, hosts };
}

export function getMetrikaCounterId() {
  const raw = (
    process.env.YANDEX_METRIKA_COUNTER_ID || "107703100"
  ).trim();
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("YANDEX_METRIKA_COUNTER_ID must be a positive number");
  }
  return id;
}

export function toolError(err) {
  if (err?.code === "NO_TOKEN") {
    return jsonResult({ error: err.message }, true);
  }
  return jsonResult(
    {
      error: err instanceof Error ? err.message : String(err),
      status: err?.status ?? null,
      details: err?.payload ?? null,
    },
    true,
  );
}

export function runMcpServer({ name, version, tools, handleToolCall }) {
  function send(message) {
    process.stdout.write(`${JSON.stringify(message)}\n`);
  }

  async function onMessage(msg) {
    if (!msg || typeof msg !== "object") return;
    const { id, method, params } = msg;

    if (method === "initialize") {
      const requested = params?.protocolVersion;
      const protocolVersion = PROTOCOL_VERSIONS.includes(requested)
        ? requested
        : "2024-11-05";
      send({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name, version },
        },
      });
      return;
    }

    if (
      method === "notifications/initialized" ||
      method === "notifications/cancelled"
    ) {
      return;
    }

    if (method === "ping") {
      send({ jsonrpc: "2.0", id, result: {} });
      return;
    }

    if (method === "tools/list") {
      send({ jsonrpc: "2.0", id, result: { tools } });
      return;
    }

    if (method === "tools/call") {
      try {
        const result = await handleToolCall(
          params?.name,
          params?.arguments || {},
        );
        send({ jsonrpc: "2.0", id, result });
      } catch (err) {
        send({ jsonrpc: "2.0", id, result: toolError(err) });
      }
      return;
    }

    if (typeof id !== "undefined") {
      send({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      });
    }
  }

  const rl = readline.createInterface({ input: process.stdin });
  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch (err) {
      process.stderr.write(`[${name}] invalid JSON: ${err}\n`);
      return;
    }
    onMessage(msg).catch((err) => {
      process.stderr.write(
        `[${name}] ${err instanceof Error ? err.stack : err}\n`,
      );
    });
  });
}
