import { isPaymentProviderHost } from "./payment-provider-hosts";
import { isYooKassaPaymentId } from "./yookassa-return-path";
import { sanitizeYclid } from "./yandex-attribution";

export const UTM_COOKIE_NAME = "promptshot_utm";
export const UTM_COOKIE_MAX_AGE_SEC = 21 * 24 * 60 * 60;
export const UTM_FIELD_MAX_LENGTH = 64;
export const UTM_LANDING_PATH_MAX_LENGTH = 200;

export const PAID_UTM_MEDIUMS = ["cpc", "cpm", "ppc"] as const;
export const SYNTHETIC_UNPAID_SOURCES = [
  "yandex_seo",
  "google_seo",
  "bing_seo",
  "direct",
  "referral",
] as const;

export type AttributionTier = "empty" | "unpaid" | "paid";
export type SyntheticUnpaidSource = (typeof SYNTHETIC_UNPAID_SOURCES)[number];

export type TrafficSourceAttribution = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  utm_landing_path: string | null;
};

export const EMPTY_TRAFFIC_SOURCE_ATTRIBUTION: TrafficSourceAttribution = {
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_content: null,
  utm_term: null,
  utm_landing_path: null,
};

export function sanitizeUtmField(
  value: unknown,
  maxLength = UTM_FIELD_MAX_LENGTH,
): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/[\u0000-\u001f\u007f]/g, "");
  if (!cleaned) return null;
  return cleaned.slice(0, maxLength);
}

export function sanitizeLandingPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let path = value.trim().replace(/[\u0000-\u001f\u007f]/g, "");
  if (!path) return null;
  path = path.split(/[?#]/, 1)[0] || "";
  if (/^https?:\/\//i.test(path) || path.startsWith("//")) {
    try {
      path = new URL(path.startsWith("//") ? `https:${path}` : path).pathname;
    } catch {
      return null;
    }
  }
  if (!path.startsWith("/")) return null;
  if (path.length > UTM_LANDING_PATH_MAX_LENGTH) {
    path = path.slice(0, UTM_LANDING_PATH_MAX_LENGTH);
  }
  return path || null;
}

function readRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object"
    ? (input as Record<string, unknown>)
    : {};
}

export function sanitizeAttributionBag(input: unknown): TrafficSourceAttribution {
  const obj = readRecord(input);
  return {
    utm_source: sanitizeUtmField(obj.utm_source ?? obj.utmSource),
    utm_medium: sanitizeUtmField(obj.utm_medium ?? obj.utmMedium),
    utm_campaign: sanitizeUtmField(obj.utm_campaign ?? obj.utmCampaign),
    utm_content: sanitizeUtmField(obj.utm_content ?? obj.utmContent),
    utm_term: sanitizeUtmField(obj.utm_term ?? obj.utmTerm),
    utm_landing_path: sanitizeLandingPath(obj.utm_landing_path ?? obj.utmLandingPath),
  };
}

export function hasFirstKnownSource(bag: TrafficSourceAttribution): boolean {
  return bag.utm_source != null;
}

export function hasAttributionSnapshot(bag: TrafficSourceAttribution): boolean {
  return bag.utm_source != null || bag.utm_landing_path != null;
}

const PAID_MEDIUM_SET = new Set<string>(PAID_UTM_MEDIUMS);

export function isPaidAttribution(
  bag: TrafficSourceAttribution,
  yclid?: string | null,
): boolean {
  if (sanitizeYclid(yclid)) return true;
  const medium = (bag.utm_medium || "").trim().toLowerCase();
  if (PAID_MEDIUM_SET.has(medium)) return true;
  const source = (bag.utm_source || "").trim().toLowerCase();
  return (source === "yandex" || source === "ya") && medium === "cpc";
}

export function attributionTier(
  bag: TrafficSourceAttribution,
  yclid?: string | null,
): AttributionTier {
  if (isPaidAttribution(bag, yclid)) return "paid";
  if (bag.utm_source != null) return "unpaid";
  return "empty";
}

function tierRank(tier: AttributionTier): number {
  if (tier === "paid") return 2;
  if (tier === "unpaid") return 1;
  return 0;
}

export function shouldReplaceAttribution(input: {
  stored: TrafficSourceAttribution;
  incoming: TrafficSourceAttribution;
  storedYclid?: string | null;
  incomingYclid?: string | null;
}): boolean {
  const incomingRank = tierRank(
    attributionTier(input.incoming, input.incomingYclid),
  );
  const storedRank = tierRank(attributionTier(input.stored, input.storedYclid));
  if (incomingRank > storedRank) return true;
  return (
    input.stored.utm_source == null &&
    input.incoming.utm_source != null &&
    isPaidAttribution(input.incoming, null)
  );
}

export function isExcludedLandingPath(pathname: string): boolean {
  const path = sanitizeLandingPath(pathname);
  if (!path) return true;
  return (
    path === "/auth" ||
    path.startsWith("/auth/") ||
    path === "/api" ||
    path.startsWith("/api/") ||
    path === "/payment" ||
    path.startsWith("/payment/")
  );
}

export function isPaymentReturnSearch(search: string | null | undefined): boolean {
  const raw = (search || "").trim();
  if (!raw) return false;
  try {
    const params = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
    return isYooKassaPaymentId(params.get("payment"));
  } catch {
    return false;
  }
}

export function isExcludedLandingLocation(
  pathname: string,
  search?: string | null,
): boolean {
  return isExcludedLandingPath(pathname) || isPaymentReturnSearch(search);
}

function normalizeReferrerHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, "");
}

export function isIdentityReferrerHost(host: string): boolean {
  const h = normalizeReferrerHost(host);
  if (!h) return false;
  if (h === "accounts.google.com" || h.endsWith(".accounts.google.com")) {
    return true;
  }
  if (h === "accounts.youtube.com" || h.endsWith(".accounts.youtube.com")) {
    return true;
  }
  if (h === "appleid.apple.com") return true;
  return /^(oauth|passport|login|id|social)\.yandex\./.test(h);
}

export function isNoiseReferrerHost(host: string): boolean {
  return isIdentityReferrerHost(host) || isPaymentProviderHost(host);
}

export function isPaymentProviderAttributionNoise(
  bag: TrafficSourceAttribution,
): boolean {
  const source = (bag.utm_source || "").trim().toLowerCase();
  const medium = (bag.utm_medium || "").trim().toLowerCase();
  const host = (bag.utm_content || "").trim();
  return source === "referral" && medium === "referral" && isPaymentProviderHost(host);
}

export function classifyReferrerHost(
  host: string | null | undefined,
): SyntheticUnpaidSource | "identity" | null {
  if (!host || typeof host !== "string") return null;
  const h = normalizeReferrerHost(host);
  if (!h) return null;
  if (isNoiseReferrerHost(h)) return "identity";
  if (h === "ya.ru" || h === "www.ya.ru" || /(^|\.)yandex\.[a-z.]+$/.test(h)) {
    return "yandex_seo";
  }
  if (/(^|\.)google\.[a-z.]+$/.test(h)) return "google_seo";
  if (h === "bing.com" || h === "www.bing.com" || /(^|\.)bing\.[a-z.]+$/.test(h)) {
    return "bing_seo";
  }
  return "referral";
}

function unpaidBagFromSource(
  source: SyntheticUnpaidSource,
  pathname: string,
  referrerHost: string | null,
): TrafficSourceAttribution {
  const path = isExcludedLandingPath(pathname) ? null : sanitizeLandingPath(pathname);
  if (source === "direct") {
    return {
      ...EMPTY_TRAFFIC_SOURCE_ATTRIBUTION,
      utm_source: "direct",
      utm_medium: "none",
      utm_landing_path: path,
    };
  }
  if (source === "referral") {
    return {
      ...EMPTY_TRAFFIC_SOURCE_ATTRIBUTION,
      utm_source: "referral",
      utm_medium: "referral",
      utm_content: sanitizeUtmField(referrerHost),
      utm_landing_path: path,
    };
  }
  return {
    ...EMPTY_TRAFFIC_SOURCE_ATTRIBUTION,
    utm_source: source,
    utm_medium: "organic",
    utm_landing_path: path,
  };
}

export function attributionFromUnpaidReferrer(input: {
  referrer: string | null | undefined;
  pageOrigin: string;
  pathname: string;
  search?: string | null;
}): TrafficSourceAttribution | null {
  if (isExcludedLandingLocation(input.pathname, input.search)) return null;
  const referrer = (input.referrer || "").trim();
  if (!referrer || referrer.toLowerCase().startsWith("android-app:")) {
    return unpaidBagFromSource("direct", input.pathname, null);
  }
  let parsed: URL;
  try {
    parsed = new URL(referrer);
  } catch {
    return unpaidBagFromSource("direct", input.pathname, null);
  }
  if (!parsed.hostname) {
    return unpaidBagFromSource("direct", input.pathname, null);
  }
  let pageOrigin: URL;
  try {
    pageOrigin = new URL(input.pageOrigin);
  } catch {
    return null;
  }
  if (parsed.origin === pageOrigin.origin) return null;
  const kind = classifyReferrerHost(parsed.hostname);
  if (kind == null || kind === "identity") return null;
  return unpaidBagFromSource(kind, input.pathname, parsed.hostname);
}

export function incomingAttributionFromLocation(input: {
  search: string;
  pathname: string;
  referrer?: string | null;
  pageOrigin?: string;
  yclid?: string | null;
}): TrafficSourceAttribution {
  const fromUrl = attributionFromLocation(input.search, input.pathname);
  if (isPaidAttribution(fromUrl, input.yclid) || hasFirstKnownSource(fromUrl)) {
    return fromUrl;
  }
  if (!input.pageOrigin) return { ...EMPTY_TRAFFIC_SOURCE_ATTRIBUTION };
  return (
    attributionFromUnpaidReferrer({
      referrer: input.referrer,
      pageOrigin: input.pageOrigin,
      pathname: input.pathname,
      search: input.search,
    }) ?? { ...EMPTY_TRAFFIC_SOURCE_ATTRIBUTION }
  );
}

export function readAttributionFromSearch(search: string): TrafficSourceAttribution {
  const normalized = search.startsWith("?") ? search.slice(1) : search;
  try {
    const params = new URLSearchParams(normalized);
    return sanitizeAttributionBag({
      utm_source: params.get("utm_source"),
      utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign"),
      utm_content: params.get("utm_content"),
      utm_term: params.get("utm_term"),
    });
  } catch {
    return { ...EMPTY_TRAFFIC_SOURCE_ATTRIBUTION };
  }
}

export function attributionFromLocation(
  search: string,
  pathname: string,
): TrafficSourceAttribution {
  return {
    ...readAttributionFromSearch(search),
    utm_landing_path: sanitizeLandingPath(pathname),
  };
}

export type AttributionResolveOptions = {
  incomingYclid?: string | null;
  storedYclid?: string | null;
};

export function resolveFirstKnownAttribution(
  incomingAttribution: TrafficSourceAttribution,
  storedAttribution: TrafficSourceAttribution | null,
  options?: AttributionResolveOptions,
): {
  attribution: TrafficSourceAttribution;
  persist: TrafficSourceAttribution | null;
} {
  const stored = storedAttribution
    ? sanitizeAttributionBag(storedAttribution)
    : { ...EMPTY_TRAFFIC_SOURCE_ATTRIBUTION };
  const incoming = sanitizeAttributionBag(incomingAttribution);
  if (
    shouldReplaceAttribution({
      stored,
      incoming,
      storedYclid: options?.storedYclid,
      incomingYclid: options?.incomingYclid,
    }) &&
    (hasAttributionSnapshot(incoming) ||
      isPaidAttribution(incoming, options?.incomingYclid))
  ) {
    return { attribution: incoming, persist: incoming };
  }
  if (attributionTier(stored, options?.storedYclid) !== "empty") {
    return { attribution: stored, persist: null };
  }
  return {
    attribution: { ...EMPTY_TRAFFIC_SOURCE_ATTRIBUTION },
    persist: null,
  };
}

export function parseAttributionCookie(raw: string | null): TrafficSourceAttribution | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const bag = sanitizeAttributionBag(parsed);
    return hasAttributionSnapshot(bag) ? bag : null;
  } catch {
    return null;
  }
}

export function serializeAttributionCookie(bag: TrafficSourceAttribution): string {
  const sanitized = sanitizeAttributionBag(bag);
  return JSON.stringify({
    utm_source: sanitized.utm_source,
    utm_medium: sanitized.utm_medium,
    utm_campaign: sanitized.utm_campaign,
    utm_content: sanitized.utm_content,
    utm_term: sanitized.utm_term,
    utm_landing_path: sanitized.utm_landing_path,
  });
}

/** Report-only: store the raw source, normalize ya/yandex when grouping. */
export function normalizeUtmSourceForReport(source: string | null): string | null {
  if (!source) return null;
  const lower = source.toLowerCase();
  return lower === "ya" || lower === "yandex" ? "yandex" : source;
}

export function shouldAttemptClientAttributionPersist(input: {
  userId: string | null | undefined;
  isAnonymous?: boolean | null;
  pathname: string;
  search?: string | null;
  alreadyPersistedUserId: string | null;
}): boolean {
  if (!input.userId) return false;
  if (input.isAnonymous === true) return false;
  if (isExcludedLandingLocation(input.pathname, input.search)) {
    return false;
  }
  return input.alreadyPersistedUserId !== input.userId;
}

export function shouldPersistAttributionOnServer(input: {
  isAnonymous?: boolean | null;
  usedGuestOwner: boolean;
  visitorId: string | null;
}): boolean {
  if (input.isAnonymous === true) return false;
  if (input.usedGuestOwner) return false;
  return input.visitorId != null;
}

export function toAttributionPersistPayload(input: {
  visitorId: string | null;
  sessionId: string | null;
  attribution: TrafficSourceAttribution;
  yclid: string | null;
}): {
  visitorId: string | null;
  sessionId: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  utm_landing_path: string | null;
  yclid: string | null;
} {
  return {
    visitorId: input.visitorId,
    sessionId: input.sessionId,
    utm_source: input.attribution.utm_source,
    utm_medium: input.attribution.utm_medium,
    utm_campaign: input.attribution.utm_campaign,
    utm_content: input.attribution.utm_content,
    utm_term: input.attribution.utm_term,
    utm_landing_path: input.attribution.utm_landing_path,
    yclid: input.yclid,
  };
}
