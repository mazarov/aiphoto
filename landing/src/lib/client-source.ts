import type { NextRequest } from "next/server";

export const CLIENT_SOURCES = [
  "site",
  "embed_stv",
  "extension_stv",
  "extension_lite",
  "foto_v_promt",
  "generaciya_foto",
  "promptshot",
  "admin",
  "scout",
  "unknown",
] as const;

export type ClientSource = (typeof CLIENT_SOURCES)[number];

/** Page buckets that a PromptShot web request may self-report via `x-client`. */
export const PROMPTSHOT_PAGE_SOURCES = [
  "foto_v_promt",
  "generaciya_foto",
  "admin",
] as const;

export type PromptshotPageSource = (typeof PROMPTSHOT_PAGE_SOURCES)[number];

type HeaderReader = { headers: { get(name: string): string | null } };

function isPromptshotPageSource(value: string): value is PromptshotPageSource {
  return (PROMPTSHOT_PAGE_SOURCES as readonly string[]).includes(value);
}

function hostname(value: string): string {
  return value.split(":")[0].toLowerCase();
}

function isPromptshotHost(value: string): boolean {
  const host = hostname(value);
  return host === "promptshot.ru" || host === "www.promptshot.ru";
}

function isImagepromptHost(value: string): boolean {
  const host = hostname(value);
  return (
    host === "imageprompt.tools" ||
    host === "www.imageprompt.tools" ||
    host === "localhost" ||
    host === "127.0.0.1"
  );
}

function originHostname(origin: string): string | null {
  if (!origin) return null;
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

/** Strip query/hash and a trailing slash (except `/`). */
export function normalizePromptshotPath(pathname: string): string {
  const raw = pathname.trim();
  if (!raw) return "/";
  const path = raw.split(/[?#]/, 1)[0] || "/";
  if (path === "/") return "/";
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

/** Map a PromptShot pathname to an analyze/remix analytics source. */
export function mapPromptshotPathToSource(pathname: string): ClientSource {
  const path = normalizePromptshotPath(pathname);
  if (path === "/foto-v-promt" || path.startsWith("/foto-v-promt/")) {
    return "foto_v_promt";
  }
  if (path === "/generaciya-foto" || path.startsWith("/generaciya-foto/")) {
    return "generaciya_foto";
  }
  if (path === "/admin" || path.startsWith("/admin/")) {
    return "admin";
  }
  return "promptshot";
}

function refererPath(referer: string): string | null {
  const raw = referer.trim();
  if (!raw) return null;
  try {
    return new URL(raw).pathname;
  } catch {
    return raw.startsWith("/") ? raw : null;
  }
}

function pageSourceFromHeader(req: HeaderReader): PromptshotPageSource | null {
  const explicit = (req.headers.get("x-client") || "").trim().toLowerCase();
  return isPromptshotPageSource(explicit) ? explicit : null;
}

function resolvePromptshotPageSource(req: HeaderReader): ClientSource {
  return (
    pageSourceFromHeader(req) ??
    mapPromptshotPathToSource(refererPath(req.headers.get("referer") || "") || "/")
  );
}

/** Resolve trusted request metadata into a normalized analytics source. */
export function resolveClientSource(
  req: NextRequest | HeaderReader,
  options?: { authenticated?: boolean },
): ClientSource {
  const origin = (req.headers.get("origin") || "").trim();
  if (origin.startsWith("chrome-extension://")) {
    const liteId = (process.env.CHROME_EXTENSION_ID_LITE || "").trim();
    return liteId && origin.toLowerCase() === `chrome-extension://${liteId}`.toLowerCase()
      ? "extension_lite"
      : "extension_stv";
  }

  if (origin) {
    const originHost = originHostname(origin);
    if (!originHost) return "unknown";
    if (isPromptshotHost(originHost)) return resolvePromptshotPageSource(req);
    if (isImagepromptHost(originHost)) {
      return pageSourceFromHeader(req) ?? "site";
    }
    return "unknown";
  }

  const host = (req.headers.get("host") || "").trim();
  if (isPromptshotHost(host)) return resolvePromptshotPageSource(req);
  if (isImagepromptHost(host)) {
    return pageSourceFromHeader(req) ?? "site";
  }
  if (options?.authenticated && host) {
    return pageSourceFromHeader(req) ?? "site";
  }
  return pageSourceFromHeader(req) ?? "unknown";
}
