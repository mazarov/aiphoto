"use client";

import { useEffect, useState } from "react";
import {
  PRICING_PAYWALL_STORAGE_KEY,
  resolvePricingPaywallVariant,
  type PricingPaywallVariant,
} from "@/lib/pricing-paywall-attribution";

export {
  PRICING_PAYWALL_EXPERIMENT_ENABLED,
  PRICING_PAYWALL_EXPERIMENT_ID,
  PRICING_PAYWALL_STORAGE_KEY,
  PRICING_PAYWALL_WINNER,
  resolvePricingPaywallVariant,
  type PricingPaywallVariant,
} from "@/lib/pricing-paywall-attribution";

export function bucketPricingPaywallVariant(
  ratio: number,
): PricingPaywallVariant {
  return ratio < 0.5 ? "control" : "treatment";
}

function randomVariant(): PricingPaywallVariant {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return bucketPricingPaywallVariant(value[0]! / 0x100000000);
  }
  return bucketPricingPaywallVariant(Math.random());
}

export function getOrAssignPricingPaywallVariant(): PricingPaywallVariant {
  const forced =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("paywall")
      : null;

  let stored: string | null = null;
  try {
    stored = localStorage.getItem(PRICING_PAYWALL_STORAGE_KEY);
  } catch {
    stored = null;
  }

  const resolved = resolvePricingPaywallVariant({ forced, stored });
  if (resolved) return resolved;

  try {
    const assigned = randomVariant();
    localStorage.setItem(PRICING_PAYWALL_STORAGE_KEY, assigned);
    return assigned;
  } catch {
    return randomVariant();
  }
}

export function usePricingPaywallVariant(): PricingPaywallVariant | null {
  const [variant, setVariant] = useState<PricingPaywallVariant | null>(null);

  useEffect(() => {
    setVariant(getOrAssignPricingPaywallVariant());
  }, []);

  return variant;
}
