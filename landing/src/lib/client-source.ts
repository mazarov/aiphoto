import type { NextRequest } from "next/server";

export const CLIENT_SOURCES = [
  "site",
  "embed_stv",
  "extension_stv",
  "extension_lite",
  "promptshot",
  "unknown",
] as const;

export type ClientSource = (typeof CLIENT_SOURCES)[number];

function isClientSource(value: string): value is ClientSource {
  return (CLIENT_SOURCES as readonly string[]).includes(value);
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

/** Resolve trusted request metadata into a normalized analytics source. */
export function resolveClientSource(
  req: NextRequest,
  options?: { authenticated?: boolean },
): ClientSource {
  const explicit = (req.headers.get("x-client") || "").trim().toLowerCase();
  if (explicit && isClientSource(explicit)) return explicit;

  const origin = (req.headers.get("origin") || "").trim();
  if (origin.startsWith("chrome-extension://")) {
    const liteId = (process.env.CHROME_EXTENSION_ID_LITE || "").trim();
    return liteId && origin.toLowerCase() === `chrome-extension://${liteId}`.toLowerCase()
      ? "extension_lite"
      : "extension_stv";
  }

  if (origin) {
    try {
      const originHost = new URL(origin).hostname;
      if (isPromptshotHost(originHost)) return "promptshot";
      if (isImagepromptHost(originHost)) return "site";
    } catch {
      return "unknown";
    }
  }

  const host = (req.headers.get("host") || "").trim();
  if (isPromptshotHost(host)) return "promptshot";
  if (isImagepromptHost(host)) return "site";
  if (options?.authenticated && host) return "site";
  return "unknown";
}
