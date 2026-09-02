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
