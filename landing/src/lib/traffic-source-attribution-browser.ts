import { readOrCreateBrowserSessionId } from "./browser-session-id";
import {
  incomingAttributionFromLocation,
  parseAttributionCookie,
  resolveFirstKnownAttribution,
  serializeAttributionCookie,
  UTM_COOKIE_MAX_AGE_SEC,
  UTM_COOKIE_NAME,
  type TrafficSourceAttribution,
} from "./traffic-source-attribution";
import {
  readYclidFromSearch,
  sanitizeYclid,
  YCLID_COOKIE_NAME,
} from "./yandex-attribution";
import { captureFirstTouchYclidFromLocation } from "./yandex-attribution-browser";
import { readOrCreateBrowserVisitorId } from "./visitor-id-browser";

export type CapturedBrowserAttribution = {
  visitorId: string | null;
  sessionId: string | null;
  attribution: TrafficSourceAttribution;
  yclid: string | null;
};

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const entry = part.trim();
    if (entry.startsWith(prefix)) {
      try {
        return decodeURIComponent(entry.slice(prefix.length));
      } catch {
        return entry.slice(prefix.length);
      }
    }
  }
  return null;
}

function writeFirstPartyCookie(name: string, value: string, maxAgeSec: number): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${secure}`;
}

export function captureFirstTouchAttributionFromLocation(): TrafficSourceAttribution {
  if (typeof window === "undefined") {
    return {
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_content: null,
      utm_term: null,
      utm_landing_path: null,
    };
  }
  const incomingYclid = readYclidFromSearch(window.location.search);
  const storedYclid = sanitizeYclid(readCookie(YCLID_COOKIE_NAME));
  const incoming = incomingAttributionFromLocation({
    search: window.location.search,
    pathname: window.location.pathname,
    referrer: document.referrer,
    pageOrigin: window.location.origin,
    yclid: incomingYclid,
  });
  const resolved = resolveFirstKnownAttribution(
    incoming,
    parseAttributionCookie(readCookie(UTM_COOKIE_NAME)),
    { incomingYclid, storedYclid },
  );
  if (resolved.persist) {
    writeFirstPartyCookie(
      UTM_COOKIE_NAME,
      serializeAttributionCookie(resolved.persist),
      UTM_COOKIE_MAX_AGE_SEC,
    );
  }
  return resolved.attribution;
}

export function captureBrowserAcquisitionContext(): CapturedBrowserAttribution {
  const visitorId = readOrCreateBrowserVisitorId();
  const sessionId = readOrCreateBrowserSessionId();
  const attribution = captureFirstTouchAttributionFromLocation();
  const yclid = captureFirstTouchYclidFromLocation();
  return { visitorId, sessionId, attribution, yclid };
}
