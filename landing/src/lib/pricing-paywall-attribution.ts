export const PRICING_PAYWALL_EXPERIMENT_ID = "pricing_paywall_2026_08";
export const PRICING_PAYWALL_STORAGE_KEY =
  "promptshot:experiment:pricing-paywall-2026-08";

export type PricingPaywallVariant = "control" | "treatment";

/** Flip to `true` to resume the 50/50 split. Assignment helpers stay in place. */
export const PRICING_PAYWALL_EXPERIMENT_ENABLED = false;
export const PRICING_PAYWALL_WINNER: PricingPaywallVariant = "treatment";

export function sanitizePricingPaywallVariant(
  value: unknown,
): PricingPaywallVariant | null {
  return value === "control" || value === "treatment" ? value : null;
}

/**
 * Shared resolver for UI, checkout attribution, and Metrika.
 * `?paywall=` always wins. When the live split is off, stored control is ignored.
 * `null` means the caller should assign and persist a fresh variant.
 */
export function resolvePricingPaywallVariant(
  input: { forced?: unknown; stored?: unknown },
  enabled: boolean = PRICING_PAYWALL_EXPERIMENT_ENABLED,
): PricingPaywallVariant | null {
  const forced = sanitizePricingPaywallVariant(input.forced);
  if (forced) return forced;
  if (!enabled) return PRICING_PAYWALL_WINNER;
  return sanitizePricingPaywallVariant(input.stored);
}
