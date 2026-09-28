#!/usr/bin/env node
/**
 * Read-only stdio MCP for PromptShot Loki.
 *
 * Env (from .cursor/loki.env via mcp.json envFile):
 *   LOKI_PUSH_URL or LOKI_QUERY_URL
 *   LOKI_BASIC_AUTH   user:password
 *
 * tools:
 *   loki_status
 *   loki_query
 *
 * Never prints the password. GET only.
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  clampInt,
  jsonResult,
  loadEnvFile,
  runMcpServer,
} from "./mcp-yandex-seo-lib.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
loadEnvFile(process.env.LOKI_ENV_FILE || resolve(ROOT, ".cursor/loki.env"));

const TOOLS = [
  {
    name: "loki_status",
    description:
      "Check that Loki is reachable with the local basic-auth file. Returns service label values. Never returns the password.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "loki_query",
    description:
      "Read recent PromptShot logs from Loki. LogQL only, for example {service=\"landing\", env=\"prod\"} or {service=\"web-generation-worker\", env=\"prod\", level=\"error\"}.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "LogQL stream selector and optional filters.",
        },
        minutes: {
          type: "number",
          description: "Look back this many minutes, 1–1440. Default 60.",
        },
        limit: {
          type: "number",
          description: "Max log lines, 1–80. Default 40. Newest first.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
];

function origin() {
  const raw = (process.env.LOKI_QUERY_URL || process.env.LOKI_PUSH_URL || "").trim();
  if (!raw) {
    const err = new Error("Missing LOKI_PUSH_URL in .cursor/loki.env");
    err.code = "NO_ENV";
    throw err;
  }
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("LOKI_PUSH_URL must be http(s)");
  }
  return url.origin;
}

function authHeader() {
  const raw = (process.env.LOKI_BASIC_AUTH || "").trim();
  if (!raw.includes(":")) {
    const err = new Error("Missing LOKI_BASIC_AUTH in .cursor/loki.env");
    err.code = "NO_ENV";
    throw err;
  }
  return `Basic ${Buffer.from(raw, "utf8").toString("base64")}`;
}

function redact(text) {
  const secret = (process.env.LOKI_BASIC_AUTH || "").trim();
  const password = secret.includes(":") ? secret.slice(secret.indexOf(":") + 1) : "";
  let out = String(text ?? "");
  if (password) out = out.split(password).join("[redacted]");
  if (secret) out = out.split(secret).join("[redacted]");
  return out.slice(0, 800);
}

async function lokiGet(path, params) {
  const url = new URL(path, origin());
  for (const [key, value] of Object.entries(params || {})) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: authHeader() },
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.text();
  if (response.status >= 300 && response.status < 400) {
    throw new Error(`Loki redirected (${response.status})`);
  }
  if (!response.ok) {
    const err = new Error(`Loki HTTP ${response.status}: ${redact(body)}`);
    err.status = response.status;
    throw err;
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`Loki returned non-JSON (${response.status})`);
  }
}

function lineTime(ts) {
  const ms = Number(BigInt(ts) / 1000000n);
  if (!Number.isFinite(ms)) return String(ts);
  return new Date(ms).toISOString();
}

async function handleStatus() {
  const host = new URL(origin()).host;
  const labels = await lokiGet("/loki/api/v1/label/service/values");
  return jsonResult({
    ok: true,
    host,
    services: labels.data || [],
  });
}

async function handleQuery(args) {
  const query = typeof args?.query === "string" ? args.query.trim() : "";
  if (!query || query.length > 500 || /[\r\n]/.test(query)) {
    return jsonResult({ error: "query must be one LogQL line up to 500 characters" }, true);
  }
  const minutes = clampInt(args?.minutes, 1, 1440, 60);
  const limit = clampInt(args?.limit, 1, 80, 40);
  const endNs = BigInt(Date.now()) * 1000000n;
  const startNs = endNs - BigInt(minutes) * 60n * 1000000000n;
  const data = await lokiGet("/loki/api/v1/query_range", {
    query,
    start: startNs.toString(),
    end: endNs.toString(),
    limit: String(limit),
    direction: "backward",
  });
  const rows = [];
  for (const stream of data?.data?.result || []) {
    const labels = stream.stream || {};
    for (const pair of stream.values || []) {
      rows.push({
        time: lineTime(pair[0]),
        service: labels.service || "",
        level: labels.level || "",
        line: String(pair[1] ?? "").slice(0, 1500),
      });
    }
  }
  rows.sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0));
  return jsonResult({
    query,
    minutes,
    count: Math.min(rows.length, limit),
    lines: rows.slice(0, limit),
  });
}

async function handleToolCall(name, args) {
  if (name === "loki_status") return handleStatus();
  if (name === "loki_query") return handleQuery(args);
  return jsonResult({ error: `Unknown tool: ${name}` }, true);
}

runMcpServer({
  name: "loki",
  version: "1.0.0",
  tools: TOOLS,
  handleToolCall,
});
