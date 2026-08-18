export const PRICING_PAYWALL_EXPERIMENT_ID = "pricing_paywall_2026_08";
export const PRICING_PAYWALL_STORAGE_KEY =
  "promptshot:experiment:pricing-paywall-2026-08";

export type PricingPaywallVariant = "control" | "treatment";

export function sanitizePricingPaywallVariant(
  value: unknown,
): PricingPaywallVariant | null {
  return value === "control" || value === "treatment" ? value : null;
}
