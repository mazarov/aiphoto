import assert from "node:assert/strict";
import test from "node:test";
import {
  CONTROL_DEFAULT_PRICING_PLAN_ID,
  CONTROL_PRICING_PLANS,
  DEFAULT_PRICING_PLAN_ID,
  PRICING_PLANS,
  TREATMENT_PRICING_PLANS,
  getDefaultPricingPlanId,
  getPaywallSwipePlans,
  getPricingPlansByAscendingPrice,
  getPricingPlanPhotoEconomics,
  getPricingPlan,
} from "./pricing-plans";

test("treatment pricing catalog matches the new paywall offer", () => {
  assert.equal(DEFAULT_PRICING_PLAN_ID, "start");
  assert.equal(PRICING_PLANS, TREATMENT_PRICING_PLANS);
  assert.deepEqual(
    PRICING_PLANS.map(({ id, price, credits }) => ({
      id,
      price,
      credits,
    })),
    [
      { id: "pro", price: 469, credits: 200 },
      { id: "trial", price: 99, credits: 30 },
      { id: "start", price: 299, credits: 100 },
      { id: "max", price: 990, credits: 500 },
    ],
  );
  assert.equal(getPricingPlan(DEFAULT_PRICING_PLAN_ID)?.recommended, true);
});

test("control pricing catalog preserves the previous offer", () => {
  assert.equal(CONTROL_DEFAULT_PRICING_PLAN_ID, "max");
  assert.equal(getDefaultPricingPlanId("control"), "max");
  assert.equal(getDefaultPricingPlanId("treatment"), "start");
  assert.deepEqual(
    CONTROL_PRICING_PLANS.map(({ id, price, credits }) => ({
      id,
      price,
      credits,
    })),
    [
      { id: "pro", price: 899, credits: 700 },
      { id: "trial", price: 199, credits: 70 },
      { id: "start", price: 399, credits: 175 },
      { id: "max", price: 1499, credits: 1550 },
    ],
  );
  assert.equal(getPricingPlan("trial", "control")?.price, 199);
  assert.equal(getPricingPlan("trial", "treatment")?.price, 99);
});

test("ascending price order is cheapest first", () => {
  assert.deepEqual(
    getPricingPlansByAscendingPrice(TREATMENT_PRICING_PLANS).map((plan) => plan.price),
    [99, 299, 469, 990],
  );
});

test("paywall swipe leads with a higher-priced pack, then the cheapest", () => {
  assert.deepEqual(
    getPaywallSwipePlans(TREATMENT_PRICING_PLANS).map((plan) => plan.id),
    ["pro", "trial", "start", "max"],
  );
  assert.deepEqual(
    getPaywallSwipePlans(CONTROL_PRICING_PLANS).map((plan) => plan.id),
    ["pro", "trial", "start", "max"],
  );
});

test("treatment photo economics derive from 5 and 10 token image models", () => {
  assert.deepEqual(
    PRICING_PLANS.map((plan) => ({
      id: plan.id,
      ...getPricingPlanPhotoEconomics(plan),
    })),
    [
      { id: "pro", minPhotos: 20, maxPhotos: 40, fromRubPerPhoto: 12 },
      { id: "trial", minPhotos: 3, maxPhotos: 6, fromRubPerPhoto: 17 },
      { id: "start", minPhotos: 10, maxPhotos: 20, fromRubPerPhoto: 15 },
      { id: "max", minPhotos: 50, maxPhotos: 100, fromRubPerPhoto: 10 },
    ],
  );
});
