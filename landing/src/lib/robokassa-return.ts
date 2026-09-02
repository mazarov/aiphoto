import { sanitizeYooKassaReturnPath } from "./yookassa-return-path";

export const ROBOKASSA_RETURN_PATH_KEY = "promptshot:robokassa-return-path";
export const ROBOKASSA_RETURN_MESSAGE_SOURCE = "promptshot-robokassa";
export const DEFAULT_ROBOKASSA_RETURN_PATH = "/";

export type RobokassaReturnMessage = {
  source: typeof ROBOKASSA_RETURN_MESSAGE_SOURCE;
  action: "return";
};

export function isRobokassaPaymentPath(path: string): boolean {
  const pathname = path.split("?")[0] ?? path;
  return pathname === "/payment" || pathname.startsWith("/payment/");
}

export function sanitizeRobokassaReturnPath(
  raw: string | null | undefined,
): string {
  const safe = sanitizeYooKassaReturnPath(raw);
  return isRobokassaPaymentPath(safe) ? DEFAULT_ROBOKASSA_RETURN_PATH : safe;
}

export function createRobokassaReturnMessage(): RobokassaReturnMessage {
  return {
    source: ROBOKASSA_RETURN_MESSAGE_SOURCE,
    action: "return",
  };
}

export function isRobokassaReturnMessage(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const message = data as Partial<RobokassaReturnMessage>;
  return (
    message.source === ROBOKASSA_RETURN_MESSAGE_SOURCE &&
    message.action === "return"
  );
}

function sessionStore(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function saveRobokassaReturnPath(path: string): string {
  const safe = sanitizeRobokassaReturnPath(path);
  try {
    sessionStore()?.setItem(ROBOKASSA_RETURN_PATH_KEY, safe);
  } catch {
    // Private mode — top-level SuccessURL falls back to `/`.
  }
  return safe;
}

export function readRobokassaReturnPath(): string {
  try {
    const stored = sessionStore()?.getItem(ROBOKASSA_RETURN_PATH_KEY);
    if (stored) return sanitizeRobokassaReturnPath(stored);
  } catch {
    // ignore
  }
  return DEFAULT_ROBOKASSA_RETURN_PATH;
}

export function clearRobokassaReturnPath(): void {
  try {
    sessionStore()?.removeItem(ROBOKASSA_RETURN_PATH_KEY);
  } catch {
    // ignore
  }
}

export function isRobokassaEmbeddedFrame(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.parent !== window;
  } catch {
    return true;
  }
}

export const ROBOKASSA_PROVIDER_ORIGINS = [
  "https://auth.robokassa.ru",
  "https://auth.robokassa.kz",
] as const;

export type RobokassaParentRedirectDecision = "close" | "keep-iframe" | "allow";

export function isRobokassaProviderOrigin(origin: string): boolean {
  return (ROBOKASSA_PROVIDER_ORIGINS as readonly string[]).includes(origin);
}

export function readRobokassaRedirectUrl(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const message = data as { action?: unknown; url?: unknown };
  if (message.action !== "redirect") return null;
  return typeof message.url === "string" ? message.url : "";
}

export function classifyRobokassaParentRedirect(
  url: string,
  siteOrigin: string,
): RobokassaParentRedirectDecision {
  if (!url.trim()) return "close";
  try {
    const parsed = new URL(url, siteOrigin);
    const site = new URL(siteOrigin);
    if (parsed.origin === site.origin) return "close";
    const host = parsed.hostname.toLowerCase();
    if (
      (host === "auth.robokassa.ru" || host === "auth.robokassa.kz") &&
      /\/merchant\/state/i.test(parsed.pathname)
    ) {
      return "keep-iframe";
    }
    return "allow";
  } catch {
    return "close";
  }
}
