import assert from "node:assert/strict";
import test from "node:test";
import { sanitizePricingPaywallVariant } from "./pricing-paywall-attribution";
import { bucketPricingPaywallVariant } from "./pricing-paywall-experiment";

test("pricing paywall experiment uses a 50/50 boundary", () => {
  assert.equal(bucketPricingPaywallVariant(0), "control");
  assert.equal(bucketPricingPaywallVariant(0.499999), "control");
  assert.equal(bucketPricingPaywallVariant(0.5), "treatment");
  assert.equal(bucketPricingPaywallVariant(0.999999), "treatment");
});

test("payment attribution accepts only known paywall variants", () => {
  assert.equal(sanitizePricingPaywallVariant("control"), "control");
  assert.equal(sanitizePricingPaywallVariant("treatment"), "treatment");
  assert.equal(sanitizePricingPaywallVariant("new"), null);
  assert.equal(sanitizePricingPaywallVariant(null), null);
});
