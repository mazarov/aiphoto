import assert from "node:assert/strict";
import test from "node:test";
import {
  PRICING_PAYWALL_EXPERIMENT_ENABLED,
  PRICING_PAYWALL_WINNER,
  resolvePricingPaywallVariant,
  sanitizePricingPaywallVariant,
} from "./pricing-paywall-attribution";
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

test("live pricing split is pinned to the treatment winner", () => {
  assert.equal(PRICING_PAYWALL_EXPERIMENT_ENABLED, false);
  assert.equal(PRICING_PAYWALL_WINNER, "treatment");
  assert.equal(resolvePricingPaywallVariant({ stored: "control" }), "treatment");
  assert.equal(resolvePricingPaywallVariant({}), "treatment");
  assert.equal(
    resolvePricingPaywallVariant({ forced: "control", stored: "treatment" }),
    "control",
  );
});

test("assignment path still returns stored variant when the split is live", () => {
  assert.equal(
    resolvePricingPaywallVariant({ stored: "control" }, true),
    "control",
  );
  assert.equal(
    resolvePricingPaywallVariant({ stored: "treatment" }, true),
    "treatment",
  );
  assert.equal(resolvePricingPaywallVariant({}, true), null);
  assert.equal(
    resolvePricingPaywallVariant({ forced: "treatment", stored: "control" }, true),
    "treatment",
  );
});
