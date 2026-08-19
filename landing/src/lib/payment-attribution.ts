import {
  sanitizeAttributionBag,
  type TrafficSourceAttribution,
} from "./traffic-source-attribution";

export function resolvePaymentTrafficSource(
  checkout: unknown,
  user: unknown,
): TrafficSourceAttribution {
  const fromCheckout = sanitizeAttributionBag(checkout);
  const fromUser = sanitizeAttributionBag(user);
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
): Partial<TrafficSourceAttribution> {
  const existing = sanitizeAttributionBag(current);
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
