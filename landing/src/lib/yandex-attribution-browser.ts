import { YANDEX_METRIKA_COUNTER_ID } from "@/lib/yandex-metrika";
import {
  readYclidFromSearch,
  resolveFirstTouchYclid,
  sanitizeYmClientId,
  sanitizeYclid,
  YCLID_COOKIE_MAX_AGE_SEC,
  YCLID_COOKIE_NAME,
} from "@/lib/yandex-attribution";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const entry = part.trim();
    if (entry.startsWith(prefix)) {
      return decodeURIComponent(entry.slice(prefix.length));
    }
  }
  return null;
}

function writeFirstPartyCookie(name: string, value: string, maxAgeSec: number): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${secure}`;
}

export function captureFirstTouchYclidFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const resolved = resolveFirstTouchYclid(
    readYclidFromSearch(window.location.search),
    readCookie(YCLID_COOKIE_NAME),
  );
  if (resolved.persist) {
    writeFirstPartyCookie(
      YCLID_COOKIE_NAME,
      resolved.persist,
      YCLID_COOKIE_MAX_AGE_SEC,
    );
  }
  return resolved.yclid;
}

function readYmClientIdFromCookie(): string | null {
  return sanitizeYmClientId(readCookie("_ym_uid"));
}

export function readYmClientId(): Promise<string | null> {
  const fromCookie = readYmClientIdFromCookie();
  if (typeof window === "undefined") return Promise.resolve(fromCookie);

  return new Promise((resolve) => {
    try {
      const ym = window.ym;
      if (typeof ym !== "function") {
        resolve(fromCookie);
        return;
      }
      let settled = false;
      const finish = (value: string | null) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const timer = window.setTimeout(() => finish(fromCookie), 800);
      ym(YANDEX_METRIKA_COUNTER_ID, "getClientID", (clientId: unknown) => {
        window.clearTimeout(timer);
        finish(sanitizeYmClientId(clientId) ?? fromCookie);
      });
    } catch {
      resolve(fromCookie);
    }
  });
}

export async function readYandexCheckoutAttribution(): Promise<{
  ymClientId: string | null;
  yclid: string | null;
}> {
  const yclid = captureFirstTouchYclidFromLocation();
  const ymClientId = await readYmClientId();
  return {
    ymClientId: sanitizeYmClientId(ymClientId),
    yclid: sanitizeYclid(yclid),
  };
}
