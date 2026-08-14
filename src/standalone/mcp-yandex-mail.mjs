#!/usr/bin/env node
/**
 * Minimal stdio MCP server: send email through Yandex SMTP.
 * Zero npm deps — Node 20+ tls + JSON-RPC on stdin/stdout.
 *
 * Env (from .cursor/yandex-smtp.env via mcp.json envFile):
 *   YANDEX_SMTP_USER  full mailbox address
 *   YANDEX_SMTP_PASS  Yandex app password (not the account password)
 *   YANDEX_SMTP_FROM_NAME  optional, default PromptShot
 *   YANDEX_SMTP_HOST  optional, default smtp.yandex.ru
 *   YANDEX_SMTP_PORT  optional, default 465
 *
 * tools:
 *   yandex_mail_status
 *   yandex_send_email  (dry_run defaults to true)
 *
 * Logs go to stderr only — stdout is MCP JSON-RPC.
 */

import tls from "node:tls";
import readline from "node:readline";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROTOCOL_VERSIONS = ["2024-11-05", "2025-03-26", "2025-06-18"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function loadEnvFile(path) {
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

loadEnvFile(
  process.env.YANDEX_SMTP_ENV_FILE || resolve(ROOT, ".cursor/yandex-smtp.env"),
);

function smtpConfig() {
  const user = (process.env.YANDEX_SMTP_USER || "").trim();
  const pass = (process.env.YANDEX_SMTP_PASS || "").trim();
  const fromName = (process.env.YANDEX_SMTP_FROM_NAME || "PromptShot").trim();
  const host = (process.env.YANDEX_SMTP_HOST || "smtp.yandex.ru").trim();
  const port = Number(process.env.YANDEX_SMTP_PORT || "465");
  return { user, pass, fromName, host, port };
}

function encodeHeader(value) {
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function normalizeBody(text) {
  const unix = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return unix
    .split("\n")
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n");
}

function waitForReply(socket) {
  let buf = "";
  const pending = [];

  function takeComplete() {
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    let acc = "";
    for (const raw of lines) {
      const line = raw.replace(/\r$/, "");
      acc += `${line}\n`;
      if (/^\d{3} /.test(line)) {
        const code = Number(line.slice(0, 3));
        const text = acc.trimEnd();
        acc = "";
        const next = pending.shift();
        if (next) next({ code, text });
      }
    }
    if (acc) buf = `${acc}${buf}`;
  }

  socket.on("data", (chunk) => {
    buf += chunk.toString("utf8");
    takeComplete();
  });

  return function readReply() {
    return new Promise((resolve, reject) => {
      pending.push((reply) => {
        if (reply.code >= 400) {
          reject(new Error(`SMTP ${reply.code}: ${reply.text}`));
          return;
        }
        resolve(reply);
      });
      takeComplete();
    });
  };
}

function writeLine(socket, line) {
  socket.write(`${line}\r\n`);
}

async function sendSmtpMail({ to, subject, body }) {
  const cfg = smtpConfig();
  if (!cfg.user || !cfg.pass) {
    throw new Error("Missing YANDEX_SMTP_USER or YANDEX_SMTP_PASS");
  }
  if (!EMAIL_RE.test(cfg.user)) {
    throw new Error("YANDEX_SMTP_USER must be a full email address");
  }
  if (!EMAIL_RE.test(to)) {
    throw new Error("Invalid recipient email");
  }

  const socket = await new Promise((resolve, reject) => {
    const sock = tls.connect(
      {
        host: cfg.host,
        port: cfg.port,
        servername: cfg.host,
        timeout: 20_000,
      },
      () => resolve(sock),
    );
    sock.once("error", reject);
  });

  const readReply = waitForReply(socket);
  try {
    await readReply();
    writeLine(socket, `EHLO promptshot.ru`);
    await readReply();
    writeLine(socket, "AUTH LOGIN");
    await readReply();
    writeLine(socket, Buffer.from(cfg.user, "utf8").toString("base64"));
    await readReply();
    writeLine(socket, Buffer.from(cfg.pass, "utf8").toString("base64"));
    await readReply();
    writeLine(socket, `MAIL FROM:<${cfg.user}>`);
    await readReply();
    writeLine(socket, `RCPT TO:<${to}>`);
    await readReply();
    writeLine(socket, "DATA");
    await readReply();

    const fromHeader = `${encodeHeader(cfg.fromName)} <${cfg.user}>`;
    const payload = [
      `From: ${fromHeader}`,
      `To: ${to}`,
      `Subject: ${encodeHeader(subject)}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      normalizeBody(body),
      "",
    ].join("\r\n");
    socket.write(`${payload}\r\n.\r\n`);
    await readReply();
    writeLine(socket, "QUIT");
    await readReply().catch(() => {});
  } finally {
    socket.end();
  }

  return {
    sent: true,
    from: cfg.user,
    to,
    host: cfg.host,
  };
}

const TOOLS = [
  {
    name: "yandex_mail_status",
    description:
      "Check whether Yandex SMTP env is configured. Does not send email and never returns the password.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "yandex_send_email",
    description:
      "Send a plain-text email via Yandex SMTP from the configured mailbox. dry_run defaults to true and only previews the message. Set dry_run=false to actually send. Never send without the user explicitly asking to send.",
    inputSchema: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "Recipient email address",
        },
        subject: {
          type: "string",
          description: "Email subject",
        },
        body: {
          type: "string",
          description: "Plain-text body",
        },
        dry_run: {
          type: "boolean",
          description: "If true (default), do not send — return a preview only",
          default: true,
        },
      },
      required: ["to", "subject", "body"],
      additionalProperties: false,
    },
  },
];

function textResult(text, isError = false) {
  return {
    content: [{ type: "text", text }],
    isError,
  };
}

function handleStatus() {
  const cfg = smtpConfig();
  const payload = {
    configured: Boolean(cfg.user && cfg.pass),
    user: cfg.user || null,
    from_name: cfg.fromName,
    host: cfg.host,
    port: cfg.port,
    password_set: Boolean(cfg.pass),
  };
  return textResult(JSON.stringify(payload, null, 2));
}

async function handleSend(args) {
  const to = typeof args?.to === "string" ? args.to.trim() : "";
  const subject = typeof args?.subject === "string" ? args.subject : "";
  const body = typeof args?.body === "string" ? args.body : "";
  const dryRun = args?.dry_run !== false;

  if (!EMAIL_RE.test(to)) {
    return textResult("Invalid `to` email address", true);
  }
  if (!subject.trim()) {
    return textResult("`subject` is required", true);
  }
  if (!body.trim()) {
    return textResult("`body` is required", true);
  }

  const cfg = smtpConfig();
  const preview = {
    dry_run: dryRun,
    from: cfg.user || null,
    from_name: cfg.fromName,
    to,
    subject,
    body,
  };

  if (dryRun) {
    return textResult(
      JSON.stringify(
        {
          ...preview,
          sent: false,
          note: "Dry run — nothing was sent. Call again with dry_run=false to send.",
        },
        null,
        2,
      ),
    );
  }

  if (!cfg.user || !cfg.pass) {
    return textResult(
      "Missing YANDEX_SMTP_USER or YANDEX_SMTP_PASS. Copy .cursor/yandex-smtp.env.example to .cursor/yandex-smtp.env and add a Yandex app password.",
      true,
    );
  }

  const result = await sendSmtpMail({ to, subject, body });
  return textResult(
    JSON.stringify({ dry_run: false, subject, ...result }, null, 2),
  );
}

async function handleToolCall(name, args) {
  if (name === "yandex_mail_status") return handleStatus();
  if (name === "yandex_send_email") return handleSend(args);
  return textResult(`Unknown tool: ${name}`, true);
}

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
        serverInfo: { name: "yandex-mail", version: "1.0.0" },
      },
    });
    return;
  }

  if (method === "notifications/initialized" || method === "notifications/cancelled") {
    return;
  }

  if (method === "ping") {
    send({ jsonrpc: "2.0", id, result: {} });
    return;
  }

  if (method === "tools/list") {
    send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
    return;
  }

  if (method === "tools/call") {
    try {
      const result = await handleToolCall(params?.name, params?.arguments || {});
      send({ jsonrpc: "2.0", id, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      send({ jsonrpc: "2.0", id, result: textResult(message, true) });
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
    process.stderr.write(`[yandex-mail] invalid JSON: ${err}\n`);
    return;
  }
  onMessage(msg).catch((err) => {
    process.stderr.write(`[yandex-mail] ${err instanceof Error ? err.stack : err}\n`);
  });
});
