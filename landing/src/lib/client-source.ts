import type { NextRequest } from "next/server";

export const CLIENT_SOURCES = [
  "site",
  "embed_stv",
  "extension_stv",
  "extension_lite",
  "unknown",
] as const;
export type ClientSource = (typeof CLIENT_SOURCES)[number];

export type ResolveClientSourceOptions = {
  /** Cookie/session auth on our API — used only when Origin is absent (same-origin fetch). */
  authenticated?: boolean;
};

function isClientSource(v: string): v is ClientSource {
  return (CLIENT_SOURCES as readonly string[]).includes(v);
}

function isPromptshotHost(host: string): boolean {
  const h = host.split(":")[0].toLowerCase();
  return (
    h === "promptshot.ru" ||
    h === "www.promptshot.ru" ||
    h === "localhost" ||
    h === "127.0.0.1"
  );
}

function resolveChromeExtensionClient(origin: string): ClientSource {
  const liteId = (process.env.CHROME_EXTENSION_ID_LITE || "").trim();
  if (liteId && origin === `chrome-extension://${liteId}`) return "extension_lite";
  return "extension_stv";
}

/**
 * Normalized client attribution for analytics.
 * X-Client header wins; Origin / Host are fallbacks.
 *
 * Canonical values: site | embed_stv | extension_stv | extension_lite | unknown
 */
export function resolveClientSource(
  req: NextRequest,
  opts?: ResolveClientSourceOptions,
): ClientSource {
  const explicit = (req.headers.get("x-client") || "").trim().toLowerCase();
  if (explicit && isClientSource(explicit)) return explicit;

  const host = (req.headers.get("host") || "").trim();
  const origin = (req.headers.get("origin") || "").trim();

  if (origin) {
    if (origin.startsWith("chrome-extension://")) {
      return resolveChromeExtensionClient(origin.toLowerCase());
    }

    try {
      const originHost = new URL(origin).hostname;
      if (isPromptshotHost(originHost)) return "site";
    } catch {
      // Malformed Origin — fall through to Host / unknown.
    }
  }

  // Logged-in site widget: same-origin POST may omit Origin; Host is enough.
  if (opts?.authenticated && host && isPromptshotHost(host)) {
    return "site";
  }

  if (host && isPromptshotHost(host)) return "site";
  return "unknown";
}
