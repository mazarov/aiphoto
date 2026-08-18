import assert from "node:assert/strict";
import test from "node:test";
import { getPricingPlan, PRICING_PLANS } from "./pricing-plans";
import {
  assertYooKassaPaymentMatches,
  getYooKassaReconciliationAction,
  parseYooKassaPayment,
} from "./yookassa-core";

function providerPayment(
  overrides: Record<string, unknown> = {},
) {
  return parseYooKassaPayment({
    id: "2f11b090-000f-5000-9000-1e9a31f4e51a",
    status: "pending",
    paid: false,
    amount: { value: "299.00", currency: "RUB" },
    confirmation: {
      type: "redirect",
      confirmation_url: "https://yoomoney.ru/checkout/example",
    },
    metadata: {
      local_payment_id: "263dd707-e1ee-46d9-9a97-c11ad34c289d",
      plan_id: "start",
    },
    test: true,
    ...overrides,
  });
}

test("pricing catalog resolves only known server-side plans", () => {
  assert.equal(PRICING_PLANS.length, 4);
  assert.equal(getPricingPlan("start")?.credits, 100);
  assert.equal(getPricingPlan("unknown"), null);
  assert.equal(getPricingPlan({ id: "start" }), null);
});

test("provider payment must match local id, plan, amount and currency", () => {
  const payment = providerPayment();
  assert.doesNotThrow(() =>
    assertYooKassaPaymentMatches(payment, {
      localPaymentId: "263dd707-e1ee-46d9-9a97-c11ad34c289d",
      planId: "start",
      priceRub: 299,
    }),
  );
  assert.doesNotThrow(() =>
    assertYooKassaPaymentMatches(payment, {
      localPaymentId: "263dd707-e1ee-46d9-9a97-c11ad34c289d",
      planId: "start",
      priceRub: Number("299.00"),
    }),
  );

  assert.throws(
    () =>
      assertYooKassaPaymentMatches(payment, {
        localPaymentId: "263dd707-e1ee-46d9-9a97-c11ad34c289d",
        planId: "start",
        priceRub: 199,
      }),
    /amount mismatch/,
  );
});

test("only a paid succeeded payment can be fulfilled", () => {
  assert.equal(getYooKassaReconciliationAction(providerPayment()), "wait");
  assert.equal(
    getYooKassaReconciliationAction(
      providerPayment({ status: "canceled", paid: false }),
    ),
    "cancel",
  );
  assert.equal(
    getYooKassaReconciliationAction(
      providerPayment({ status: "succeeded", paid: true }),
    ),
    "fulfill",
  );
  assert.throws(
    () =>
      getYooKassaReconciliationAction(
        providerPayment({ status: "succeeded", paid: false }),
      ),
    /not marked paid/,
  );
});
