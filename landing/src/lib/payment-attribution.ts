import { sanitizeYclid } from "./yandex-attribution";
import {
  EMPTY_TRAFFIC_SOURCE_ATTRIBUTION,
  hasFirstKnownSource,
  isPaidAttribution,
  isPaymentProviderAttributionNoise,
  sanitizeAttributionBag,
  shouldReplaceAttribution,
  type TrafficSourceAttribution,
} from "./traffic-source-attribution";

function checkoutBagForResolve(checkout: unknown): TrafficSourceAttribution {
  const bag = sanitizeAttributionBag(checkout);
  if (isPaymentProviderAttributionNoise(bag)) {
    return { ...EMPTY_TRAFFIC_SOURCE_ATTRIBUTION };
  }
  return bag;
}

export function resolvePaymentTrafficSource(
  checkout: unknown,
  user: unknown,
  options?: {
    checkoutYclid?: string | null;
    userYclid?: string | null;
  },
): TrafficSourceAttribution {
  const fromCheckout = checkoutBagForResolve(checkout);
  const fromUser = sanitizeAttributionBag(user);
  if (
    shouldReplaceAttribution({
      stored: fromUser,
      incoming: fromCheckout,
      storedYclid: options?.userYclid,
      incomingYclid: options?.checkoutYclid,
    })
  ) {
    return fromCheckout;
  }
  if (
    shouldReplaceAttribution({
      stored: fromCheckout,
      incoming: fromUser,
      storedYclid: options?.checkoutYclid,
      incomingYclid: options?.userYclid,
    })
  ) {
    return fromUser;
  }
  if (
    hasFirstKnownSource(fromUser) &&
    !isPaidAttribution(fromUser, options?.userYclid) &&
    !isPaidAttribution(fromCheckout, options?.checkoutYclid)
  ) {
    return fromUser;
  }
  return {
    utm_source: fromCheckout.utm_source ?? fromUser.utm_source,
    utm_medium: fromCheckout.utm_medium ?? fromUser.utm_medium,
    utm_campaign: fromCheckout.utm_campaign ?? fromUser.utm_campaign,
    utm_content: fromCheckout.utm_content ?? fromUser.utm_content,
    utm_term: fromCheckout.utm_term ?? fromUser.utm_term,
    utm_landing_path:
      fromCheckout.utm_landing_path ?? fromUser.utm_landing_path,
  };
}

export function attributionSnapshotPatch(
  current: unknown,
  resolved: TrafficSourceAttribution,
  options?: {
    currentYclid?: string | null;
    resolvedYclid?: string | null;
  },
): Partial<TrafficSourceAttribution> {
  const existing = sanitizeAttributionBag(current);
  if (
    shouldReplaceAttribution({
      stored: existing,
      incoming: resolved,
      storedYclid: options?.currentYclid,
      incomingYclid: options?.resolvedYclid,
    })
  ) {
    return { ...resolved };
  }
  const patch: Partial<TrafficSourceAttribution> = {};
  const mutable = patch as Record<
    keyof TrafficSourceAttribution,
    string | null | undefined
  >;
  for (const key of Object.keys(resolved) as Array<keyof TrafficSourceAttribution>) {
    if (existing[key] == null && resolved[key] != null) {
      mutable[key] = resolved[key];
    }
  }
  return patch;
}

export function shouldWriteLandingUserAttribution(
  bag: TrafficSourceAttribution,
  yclid?: string | null,
): boolean {
  return hasFirstKnownSource(bag) || sanitizeYclid(yclid) != null;
}
