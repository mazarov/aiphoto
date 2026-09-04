/**
 * IMAP + MIME helpers for mcp-yandex-mail.mjs.
 * Zero npm deps — Node 20+ tls.
 */

import tls from "node:tls";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const DEFAULT_IMAP_HOST = "imap.yandex.ru";
export const DEFAULT_IMAP_PORT = 993;
export const LIST_LIMIT_DEFAULT = 20;
export const LIST_LIMIT_MAX = 50;
export const BODY_CHAR_LIMIT = 12_000;
export const LITERAL_BYTE_LIMIT = 512 * 1024;

const SOCKET_TIMEOUT_MS = 25_000;

export function imapConfig() {
  const user = (process.env.YANDEX_SMTP_USER || "").trim();
  const pass = (process.env.YANDEX_SMTP_PASS || "").trim();
  const host = (process.env.YANDEX_IMAP_HOST || DEFAULT_IMAP_HOST).trim();
  const port = Number(process.env.YANDEX_IMAP_PORT || String(DEFAULT_IMAP_PORT));
  return { user, pass, host, port };
}

export function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export function imapQuote(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function decodeModifiedUtf7(name) {
  return String(name).replace(/&([^-]*)-/g, (_, payload) => {
    if (!payload) return "&";
    const b64 = payload.replace(/,/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    try {
      const buf = Buffer.from(`${b64}${pad}`, "base64");
      return new TextDecoder("utf-16be").decode(buf);
    } catch {
      return `&${payload}-`;
    }
  });
}

export function decodeQuotedPrintableBytes(input) {
  const s = String(input).replace(/=\r?\n/g, "");
  const bytes = [];
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(s.slice(i + 1, i + 3))) {
      bytes.push(parseInt(s.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(s.charCodeAt(i) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

export function decodeRfc2047(value) {
  const raw = String(value).replace(
    /=\?([^?]+)\?([bBqQ])\?([^?]*)\?=\s*/g,
    (_, charset, enc, data) => {
      let buf;
      if (enc.toUpperCase() === "B") {
        buf = Buffer.from(String(data).replace(/\s/g, ""), "base64");
      } else {
        buf = decodeQuotedPrintableBytes(String(data).replace(/_/g, " "));
      }
      return decodeCharset(buf, charset);
    },
  );
  return raw.replace(/[ \t]+\n/g, "\n").trim();
}

export function decodeCharset(buf, charset) {
  const bytes = Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf), "binary");
  const cs = String(charset || "utf-8").trim() || "utf-8";
  const aliases = {
    "utf8": "utf-8",
    "utf-8": "utf-8",
    "us-ascii": "utf-8",
    "ascii": "utf-8",
    "iso-8859-1": "latin1",
    "latin1": "latin1",
    "windows-1251": "windows-1251",
    "cp1251": "windows-1251",
    "koi8-r": "koi8-r",
  };
  const label = aliases[cs.toLowerCase()] || cs;
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return bytes.toString("utf8");
  }
}

function splitSemicolons(value) {
  const parts = [];
  let cur = "";
  let inQuotes = false;
  for (const ch of String(value)) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      cur += ch;
      continue;
    }
    if (ch === ";" && !inQuotes) {
      if (cur.trim()) parts.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

export function parseContentType(value) {
  const bits = splitSemicolons(value || "text/plain");
  const [kindRaw = "text/plain", ...rest] = bits;
  const [type, subtype] = kindRaw.toLowerCase().split("/");
  const params = {};
  for (const item of rest) {
    const eq = item.indexOf("=");
    if (eq < 0) continue;
    const key = item.slice(0, eq).trim().toLowerCase();
    let val = item.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    params[key] = val;
  }
  return {
    type: type || "text",
    subtype: subtype || "plain",
    params,
  };
}

export function parseHeaders(raw) {
  const unfolded = String(raw).replace(/\r\n[ \t]/g, " ").replace(/\n[ \t]/g, " ");
  const headers = {};
  for (const line of unfolded.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const val = decodeRfc2047(line.slice(idx + 1).trim());
    if (!key) continue;
    headers[key] = headers[key] ? `${headers[key]}, ${val}` : val;
  }
  return headers;
}

export function splitHeaderBody(raw) {
  const text = String(raw);
  const crlf = text.indexOf("\r\n\r\n");
  const lf = text.indexOf("\n\n");
  let idx = -1;
  let sepLen = 0;
  if (crlf >= 0 && (lf < 0 || crlf <= lf)) {
    idx = crlf;
    sepLen = 4;
  } else if (lf >= 0) {
    idx = lf;
    sepLen = 2;
  }
  if (idx < 0) return { headerRaw: text, bodyRaw: "" };
  return {
    headerRaw: text.slice(0, idx),
    bodyRaw: text.slice(idx + sepLen),
  };
}

function decodeTransfer(bodyRaw, encoding) {
  const enc = String(encoding || "7bit").toLowerCase();
  if (enc === "base64") {
    return Buffer.from(String(bodyRaw).replace(/\s/g, ""), "base64");
  }
  if (enc === "quoted-printable") {
    return decodeQuotedPrintableBytes(bodyRaw);
  }
  return Buffer.from(String(bodyRaw), "binary");
}

function parseFilename(disposition, ctParams) {
  const disp = String(disposition || "");
  const star = /filename\*\s*=\s*([^;]+)/i.exec(disp);
  if (star) {
    let val = star[1].trim().replace(/^"|"$/g, "");
    const rfc2231 = /^[^']*'[^']*'(.*)$/.exec(val);
    if (rfc2231) {
      try {
        return decodeURIComponent(rfc2231[1]);
      } catch {
        return rfc2231[1];
      }
    }
  }
  const plain = /filename\s*=\s*("(?:\\.|[^"])*"|[^;]+)/i.exec(disp);
  if (plain) {
    let val = plain[1].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    return decodeRfc2047(val);
  }
  if (ctParams?.name) return decodeRfc2047(ctParams.name);
  return null;
}

function splitMultipart(bodyRaw, boundary) {
  if (!boundary) return [];
  const text = String(bodyRaw);
  const sep = `--${boundary}`;
  const chunks = text.split(sep);
  const parts = [];
  for (let i = 1; i < chunks.length; i += 1) {
    let chunk = chunks[i];
    if (chunk.startsWith("--")) break;
    chunk = chunk.replace(/^\r?\n/, "");
    chunk = chunk.replace(/\r?\n$/, "");
    if (chunk) parts.push(chunk);
  }
  return parts;
}

function binaryToUtf8(raw) {
  const s = String(raw);
  if (/[^\u0000-\u00FF]/.test(s)) return s;
  return Buffer.from(s, "binary").toString("utf8");
}

export function parseMimePart(raw) {
  const asBinary = Buffer.isBuffer(raw) ? raw.toString("binary") : String(raw);
  const { headerRaw, bodyRaw } = splitHeaderBody(asBinary);
  const headers = parseHeaders(binaryToUtf8(headerRaw));
  const ct = parseContentType(headers["content-type"] || "text/plain");
  const encoding = headers["content-transfer-encoding"] || "7bit";
  const disposition = headers["content-disposition"] || "";
  const filename = parseFilename(disposition, ct.params);

  if (ct.type === "multipart") {
    const children = splitMultipart(bodyRaw, ct.params.boundary).map(parseMimePart);
    return {
      kind: "multipart",
      subtype: ct.subtype,
      headers,
      parts: children,
      filename,
    };
  }

  const bytes = decodeTransfer(bodyRaw, encoding);
  const isAttachment =
    /attachment/i.test(disposition) ||
    Boolean(filename && ct.type !== "text" && ct.type !== "multipart");
  const text =
    ct.type === "text" ? decodeCharset(bytes, ct.params.charset || "utf-8") : "";

  return {
    kind: "leaf",
    type: ct.type,
    subtype: ct.subtype,
    headers,
    filename,
    isAttachment,
    text,
  };
}

export function htmlToText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => {
      const code = parseInt(n, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function collectFromPart(part, acc) {
  if (!part) return;
  if (part.kind === "multipart") {
    if (part.subtype === "alternative") {
      const plain = part.parts.find(
        (child) => child.kind === "leaf" && child.type === "text" && child.subtype === "plain" && !child.isAttachment,
      );
      const html = part.parts.find(
        (child) => child.kind === "leaf" && child.type === "text" && child.subtype === "html" && !child.isAttachment,
      );
      if (plain?.text) acc.plain.push(plain.text);
      else if (html?.text) acc.html.push(html.text);
      for (const child of part.parts) {
        if (child !== plain && child !== html) collectFromPart(child, acc);
      }
      return;
    }
    for (const child of part.parts) collectFromPart(child, acc);
    return;
  }
  if (part.isAttachment || part.filename) {
    acc.attachments.push({
      filename: part.filename || "attachment",
      content_type: `${part.type}/${part.subtype}`,
    });
    return;
  }
  if (part.type === "text" && part.subtype === "plain" && part.text) {
    acc.plain.push(part.text);
    return;
  }
  if (part.type === "text" && part.subtype === "html" && part.text) {
    acc.html.push(part.text);
  }
}

export function extractReadableBody(rfc822) {
  const root = parseMimePart(rfc822);
  const acc = { plain: [], html: [], attachments: [] };
  collectFromPart(root, acc);
  const headers = root.headers || parseHeaders(splitHeaderBody(rfc822).headerRaw);
  let body = acc.plain.join("\n\n").trim();
  let htmlOnly = false;
  if (!body && acc.html.length) {
    body = htmlToText(acc.html.join("\n"));
    htmlOnly = true;
  }
  const truncated = body.length > BODY_CHAR_LIMIT;
  if (truncated) body = `${body.slice(0, BODY_CHAR_LIMIT)}\n…`;
  return {
    headers,
    body,
    body_truncated: truncated,
    html_only: htmlOnly,
    attachments: acc.attachments,
  };
}

export function parseAddressField(value) {
  const raw = String(value || "").trim();
  if (!raw) return { display: "", email: null };
  const angle = /<([^>]+)>/.exec(raw);
  if (angle && EMAIL_RE.test(angle[1].trim())) {
    return { display: raw, email: angle[1].trim() };
  }
  if (EMAIL_RE.test(raw)) return { display: raw, email: raw };
  return { display: raw, email: null };
}

export function truncateBody(text) {
  const body = String(text || "").trim();
  const truncated = body.length > BODY_CHAR_LIMIT;
  return {
    body: truncated ? `${body.slice(0, BODY_CHAR_LIMIT)}\n…` : body,
    body_truncated: truncated,
  };
}

function litMarker(index) {
  return `\u0001LIT${index}\u0001`;
}

export function parseSearchUids(line) {
  const m = /^\* SEARCH(?: (.+))?$/.exec(String(line).trim());
  if (!m) return [];
  if (!m[1]) return [];
  return m[1]
    .trim()
    .split(/\s+/)
    .map((x) => Number(x))
    .filter((n) => Number.isInteger(n) && n > 0);
}

export function parseExists(line) {
  const m = /^\* (\d+) EXISTS$/.exec(String(line).trim());
  return m ? Number(m[1]) : null;
}

export function parseStatusCounts(line) {
  const m = /^\* STATUS .+ \((.*)\)\s*$/.exec(String(line).trim());
  if (!m) return null;
  const inner = m[1];
  const messages = /MESSAGES (\d+)/.exec(inner);
  const unseen = /UNSEEN (\d+)/.exec(inner);
  return {
    messages: messages ? Number(messages[1]) : null,
    unseen: unseen ? Number(unseen[1]) : null,
  };
}

export function parseListMailbox(line, literals = []) {
  const m = /^\* LIST \(([^)]*)\) ("(?:\\.|[^"])*"|NIL) (.+)$/.exec(
    String(line).trim(),
  );
  if (!m) return null;
  const flags = m[1]
    .trim()
    .split(/\s+/)
    .map((f) => f.replace(/^\\/, "").toLowerCase())
    .filter(Boolean);
  if (flags.includes("noselect")) return null;
  let mailbox = m[3].trim();
  const lit = /^\u0001LIT(\d+)\u0001$/.exec(mailbox);
  if (lit) {
    mailbox = literals[Number(lit[1])]?.toString("utf8") || mailbox;
  } else if (mailbox.startsWith('"') && mailbox.endsWith('"')) {
    mailbox = mailbox.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return {
    name: decodeModifiedUtf7(mailbox),
    flags,
    sent: flags.includes("sent"),
    drafts: flags.includes("drafts"),
    junk: flags.includes("junk") || flags.includes("spam"),
    trash: flags.includes("trash"),
  };
}

export function parseFetchLine(line, literals = []) {
  const text = String(line);
  const head = /^\* (\d+) FETCH /i.exec(text);
  if (!head) return null;
  const seq = Number(head[1]);
  const uid = Number(/\bUID (\d+)/i.exec(text)?.[1] || 0);
  const flagsInner = /\bFLAGS \(([^)]*)\)/.exec(text)?.[1] || "";
  const flags = flagsInner
    .trim()
    .split(/\s+/)
    .map((f) => f.replace(/^\\/, "").toLowerCase())
    .filter(Boolean);
  const internalDate = /\bINTERNALDATE "([^"]*)"/.exec(text)?.[1] || "";
  const bodies = {};
  const re =
    /BODY\[([^\]]*)\](?:<[^>]+>)?\s+(?:NIL|"((?:\\.|[^"\\])*)"|(\u0001LIT\d+\u0001))/gi;
  let match;
  while ((match = re.exec(text))) {
    const section = match[1];
    let raw = "";
    if (match[3]) {
      const idx = Number(/\u0001LIT(\d+)\u0001/.exec(match[3])?.[1] || -1);
      raw = literals[idx] ? literals[idx].toString("binary") : "";
    } else if (match[2] != null) {
      raw = match[2].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }
    bodies[section] = raw;
  }
  return { seq, uid, flags, internalDate, bodies, seen: flags.includes("seen") };
}

function headerFromBodies(bodies) {
  const keys = Object.keys(bodies);
  const headerKey =
    keys.find((k) => /^HEADER/i.test(k)) ||
    keys.find((k) => /HEADER\.FIELDS/i.test(k));
  if (headerKey) return bodies[headerKey];
  if (bodies[""]) {
    return splitHeaderBody(bodies[""]).headerRaw;
  }
  return "";
}

function rfc822FromBodies(bodies) {
  if (bodies[""]) return bodies[""];
  const header = headerFromBodies(bodies);
  const textKey = Object.keys(bodies).find((k) => k.toUpperCase() === "TEXT");
  if (header && textKey != null) {
    return `${header}\r\n\r\n${bodies[textKey]}`;
  }
  return header || "";
}

export function summarizeFetchedMessage(fetch) {
  const headerRaw = headerFromBodies(fetch.bodies);
  const headers = parseHeaders(binaryToUtf8(headerRaw));
  const from = parseAddressField(headers.from);
  const to = parseAddressField(headers.to);
  return {
    uid: fetch.uid,
    seq: fetch.seq,
    date: fetch.internalDate || headers.date || "",
    from: from.display,
    from_email: from.email,
    to: to.display || headers.to || "",
    subject: headers.subject || "",
    seen: fetch.seen,
    message_id: headers["message-id"] || null,
  };
}

export function detailFetchedMessage(fetch) {
  const rfc822 = rfc822FromBodies(fetch.bodies);
  const extracted = extractReadableBody(rfc822.includes("\n") ? rfc822 : `${rfc822}`);
  const from = parseAddressField(extracted.headers.from);
  const to = parseAddressField(extracted.headers.to);
  const replyTo = parseAddressField(extracted.headers["reply-to"]);
  return {
    uid: fetch.uid,
    seq: fetch.seq,
    date: fetch.internalDate || extracted.headers.date || "",
    from: from.display,
    from_email: from.email,
    to: to.display || extracted.headers.to || "",
    cc: extracted.headers.cc || "",
    reply_to: replyTo.email || replyTo.display || null,
    subject: extracted.headers.subject || "",
    message_id: extracted.headers["message-id"] || null,
    in_reply_to: extracted.headers["in-reply-to"] || null,
    seen: fetch.seen,
    body: extracted.body,
    body_truncated: extracted.body_truncated,
    html_only: extracted.html_only,
    attachments: extracted.attachments,
  };
}

class ByteReader {
  constructor(socket) {
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.waiters = [];
    socket.on("data", (chunk) => {
      this.buf = Buffer.concat([this.buf, chunk]);
      this.flush();
    });
    socket.on("error", (err) => this.failAll(err));
    socket.on("close", () =>
      this.failAll(new Error("IMAP connection closed")),
    );
  }

  failAll(err) {
    const waiters = this.waiters.splice(0);
    for (const w of waiters) w.reject(err);
  }

  flush() {
    while (this.waiters.length) {
      const w = this.waiters[0];
      if (w.type === "exact") {
        if (this.buf.length < w.n) return;
        const out = this.buf.subarray(0, w.n);
        this.buf = this.buf.subarray(w.n);
        this.waiters.shift();
        w.resolve(Buffer.from(out));
        continue;
      }
      const idx = this.buf.indexOf(0x0a);
      if (idx < 0) return;
      let line = this.buf.subarray(0, idx);
      this.buf = this.buf.subarray(idx + 1);
      if (line.length && line[line.length - 1] === 0x0d) {
        line = line.subarray(0, line.length - 1);
      }
      this.waiters.shift();
      w.resolve(line.toString("utf8"));
    }
  }

  readLine() {
    return new Promise((resolve, reject) => {
      this.waiters.push({ type: "line", resolve, reject });
      this.flush();
    });
  }

  readExact(n) {
    return new Promise((resolve, reject) => {
      this.waiters.push({ type: "exact", n, resolve, reject });
      this.flush();
    });
  }
}

async function readLogical(reader) {
  const literals = [];
  let text = "";
  while (true) {
    const line = await reader.readLine();
    const lit = /\{(\d+)\}$/.exec(line);
    if (!lit) {
      text += line;
      return { text, literals };
    }
    const size = Number(lit[1]);
    if (size > LITERAL_BYTE_LIMIT) {
      throw new Error(`IMAP literal too large (${size} bytes)`);
    }
    text += `${line.slice(0, lit.index)}${litMarker(literals.length)}`;
    literals.push(await reader.readExact(size));
  }
}

export class ImapSession {
  constructor(socket) {
    this.socket = socket;
    this.reader = new ByteReader(socket);
    this.tagSeq = 0;
  }

  nextTag() {
    this.tagSeq += 1;
    return `A${this.tagSeq}`;
  }

  write(line) {
    this.socket.write(`${line}\r\n`);
  }

  async greeting() {
    const { text } = await readLogical(this.reader);
    if (!/^\* OK/i.test(text)) {
      throw new Error(`IMAP greeting failed: ${text.slice(0, 200)}`);
    }
  }

  async command(cmd) {
    const tag = this.nextTag();
    this.write(`${tag} ${cmd}`);
    const untagged = [];
    while (true) {
      const logical = await readLogical(this.reader);
      const { text, literals } = logical;
      if (text.startsWith("+")) {
        throw new Error(`IMAP unexpected continuation: ${text.slice(0, 200)}`);
      }
      if (text.startsWith("*")) {
        untagged.push(logical);
        continue;
      }
      if (text.startsWith(`${tag} `)) {
        const ok = text.startsWith(`${tag} OK`);
        if (!ok) {
          const err = new Error(text.slice(tag.length + 1, tag.length + 400));
          err.imapLine = text;
          throw err;
        }
        return { tag, text, untagged };
      }
    }
  }

  async login(user, pass) {
    try {
      await this.command(`LOGIN ${imapQuote(user)} ${imapQuote(pass)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `IMAP login failed. Enable IMAP in Yandex Mail → Settings → Email clients, and use the same app password as SMTP. ${msg}`,
      );
    }
  }

  async logout() {
    try {
      await this.command("LOGOUT");
    } catch {
      // ignore
    }
  }

  mailboxArg(folder) {
    const name = String(folder || "INBOX").trim() || "INBOX";
    if (/[\r\n"%\\]/.test(name) && name.toUpperCase() !== "INBOX") {
      throw new Error("Invalid IMAP folder name");
    }
    if (name.toUpperCase() === "INBOX") return "INBOX";
    return imapQuote(name);
  }

  async examine(folder) {
    const res = await this.command(`EXAMINE ${this.mailboxArg(folder)}`);
    let exists = 0;
    for (const item of res.untagged) {
      const n = parseExists(item.text);
      if (n != null) exists = n;
    }
    return exists;
  }

  async listFolders() {
    const res = await this.command(`LIST "" "*"`);
    const folders = [];
    for (const item of res.untagged) {
      const parsed = parseListMailbox(item.text, item.literals);
      if (parsed) folders.push(parsed);
    }
    return folders;
  }

  async statusInbox() {
    const res = await this.command("STATUS INBOX (MESSAGES UNSEEN)");
    for (const item of res.untagged) {
      const parsed = parseStatusCounts(item.text);
      if (parsed) return parsed;
    }
    return { messages: null, unseen: null };
  }

  async uidSearch(criteria) {
    const res = await this.command(`UID SEARCH ${criteria}`);
    for (const item of res.untagged) {
      if (item.text.startsWith("* SEARCH")) {
        return parseSearchUids(item.text);
      }
    }
    return [];
  }

  async fetchRange(start, end, spec) {
    const res = await this.command(`FETCH ${start}:${end} ${spec}`);
    return res.untagged
      .map((item) => parseFetchLine(item.text, item.literals))
      .filter(Boolean);
  }

  async uidFetch(uids, spec) {
    const list = [...new Set(uids.filter((n) => Number.isInteger(n) && n > 0))];
    if (!list.length) return [];
    const res = await this.command(`UID FETCH ${list.join(",")} ${spec}`);
    return res.untagged
      .map((item) => parseFetchLine(item.text, item.literals))
      .filter(Boolean);
  }
}

const LIST_FETCH =
  "(UID FLAGS INTERNALDATE BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)])";
const READ_FETCH =
  "(UID FLAGS INTERNALDATE BODY.PEEK[HEADER] BODY.PEEK[TEXT])";

export function buildSearchCriteria({ unreadOnly, from, subject }) {
  const parts = [];
  if (unreadOnly) parts.push("UNSEEN");
  if (from) parts.push(`FROM ${imapQuote(from)}`);
  if (subject) parts.push(`SUBJECT ${imapQuote(subject)}`);
  return parts.length ? parts.join(" ") : "ALL";
}

export async function withImap(fn) {
  const cfg = imapConfig();
  if (!cfg.user || !cfg.pass) {
    throw new Error("Missing YANDEX_SMTP_USER or YANDEX_SMTP_PASS");
  }
  if (!EMAIL_RE.test(cfg.user)) {
    throw new Error("YANDEX_SMTP_USER must be a full email address");
  }

  const socket = await new Promise((resolve, reject) => {
    const sock = tls.connect(
      {
        host: cfg.host,
        port: cfg.port,
        servername: cfg.host,
        timeout: SOCKET_TIMEOUT_MS,
      },
      () => resolve(sock),
    );
    sock.once("error", reject);
  });
  socket.setTimeout(SOCKET_TIMEOUT_MS, () => {
    socket.destroy(new Error("IMAP socket timeout"));
  });

  const session = new ImapSession(socket);
  try {
    await session.greeting();
    await session.login(cfg.user, cfg.pass);
    return await fn(session, cfg);
  } finally {
    await session.logout().catch(() => {});
    socket.end();
    socket.destroy();
  }
}

export async function listMessages({
  folder = "INBOX",
  limit = LIST_LIMIT_DEFAULT,
  unreadOnly = false,
  from = "",
  subject = "",
} = {}) {
  const take = clampInt(limit, 1, LIST_LIMIT_MAX, LIST_LIMIT_DEFAULT);
  return withImap(async (session, cfg) => {
    const exists = await session.examine(folder);
    const filtered = unreadOnly || from || subject;
    let fetches;
    if (filtered) {
      const uids = await session.uidSearch(
        buildSearchCriteria({ unreadOnly, from, subject }),
      );
      const slice = uids.slice(-take);
      fetches = slice.length ? await session.uidFetch(slice, LIST_FETCH) : [];
    } else if (exists === 0) {
      fetches = [];
    } else {
      const start = Math.max(1, exists - take + 1);
      fetches = await session.fetchRange(start, exists, LIST_FETCH);
    }
    const messages = fetches
      .map(summarizeFetchedMessage)
      .sort((a, b) => (a.uid || 0) - (b.uid || 0))
      .reverse();
    return {
      folder,
      host: cfg.host,
      exists,
      count: messages.length,
      messages,
    };
  });
}

export async function readMessage({
  uid,
  folder = "INBOX",
} = {}) {
  const id = Number(uid);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("uid must be a positive integer");
  }
  return withImap(async (session, cfg) => {
    await session.examine(folder);
    const fetches = await session.uidFetch([id], READ_FETCH);
    if (!fetches.length) {
      throw new Error(`Message uid ${id} not found in ${folder}`);
    }
    return {
      folder,
      host: cfg.host,
      ...detailFetchedMessage(fetches[0]),
    };
  });
}

export async function listFolders() {
  return withImap(async (session, cfg) => {
    const folders = await session.listFolders();
    return { host: cfg.host, folders };
  });
}

export async function inboxStatus() {
  return withImap(async (session) => session.statusInbox());
}
