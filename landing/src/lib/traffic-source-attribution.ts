export const UTM_COOKIE_NAME = "promptshot_utm";
export const UTM_COOKIE_MAX_AGE_SEC = 21 * 24 * 60 * 60;
export const UTM_FIELD_MAX_LENGTH = 64;
export const UTM_LANDING_PATH_MAX_LENGTH = 200;

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

export function resolveFirstKnownAttribution(
  urlAttribution: TrafficSourceAttribution,
  storedAttribution: TrafficSourceAttribution | null,
): {
  attribution: TrafficSourceAttribution;
  persist: TrafficSourceAttribution | null;
} {
  const stored = storedAttribution
    ? sanitizeAttributionBag(storedAttribution)
    : { ...EMPTY_TRAFFIC_SOURCE_ATTRIBUTION };
  if (hasFirstKnownSource(stored)) {
    return { attribution: stored, persist: null };
  }
  const fromUrl = sanitizeAttributionBag(urlAttribution);
  if (hasFirstKnownSource(fromUrl)) {
    return { attribution: fromUrl, persist: fromUrl };
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
    return hasFirstKnownSource(bag) ? bag : null;
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
  alreadyPersistedUserId: string | null;
}): boolean {
  if (!input.userId) return false;
  if (input.isAnonymous === true) return false;
  if (
    input.pathname === "/auth/callback" ||
    input.pathname.startsWith("/auth/callback/")
  ) {
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
