import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCheckoutOffer,
  CheckoutOfferNotAppliedError,
  lockCheckoutCharge,
  parseLiveMailOffer,
  pricingOfferPercentForPlan,
  resolveCheckoutCharge,
} from "./mail-checkout-offer";
import type { MailRpcClient } from "./mail-outbox";

test("applyCheckoutOffer uses the locked grant amount", async () => {
  const supabase: MailRpcClient = {
    async rpc() {
      return {
        data: { quoted_amount_rub: 239, quoted_offer_id: "off-1", quoted_percent: 20 },
        error: null,
      };
    },
  };
  const quote = await applyCheckoutOffer(supabase, {
    sharedUserId: "user-1",
    paymentId: "pay-1",
    provider: "yookassa",
    catalogAmount: 299,
  });
  assert.deepEqual(quote, { amountRub: 239, offerId: "off-1", percent: 20 });
});

test("applyCheckoutOffer still reads the pre-246 grant columns", async () => {
  const supabase: MailRpcClient = {
    async rpc() {
      return { data: { amount_rub: 89, offer_id: "off-1", percent: 10 }, error: null };
    },
  };
  const quote = await applyCheckoutOffer(supabase, {
    sharedUserId: "user-1",
    paymentId: "pay-1",
    provider: "yookassa",
    catalogAmount: 99,
  });
  assert.deepEqual(quote, { amountRub: 89, offerId: "off-1", percent: 10 });
});

test("lockCheckoutCharge reads the payment row through MailRpcClient only", async () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  const supabase: MailRpcClient & {
    from(): {
      select(): {
        eq(): {
          maybeSingle(): Promise<{
            data: { amount_rub: number; offer_id: string };
            error: null;
          }>;
        };
      };
    };
  } = {
    async rpc(fn) {
      if (fn === "landing_live_pricing_offer") {
        return {
          data: {
            offer_id: "off-1",
            percent: 20,
            expires_at: future,
            target_plan_id: "start",
          },
          error: null,
        };
      }
      return {
        data: { quoted_amount_rub: 299, quoted_offer_id: null, quoted_percent: 0 },
        error: null,
      };
    },
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return {
                    data: { amount_rub: 239, offer_id: "off-1" },
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };
  const quote = await lockCheckoutCharge(supabase, {
    sharedUserId: "user-1",
    paymentId: "pay-1",
    provider: "yookassa",
    catalogAmount: 299,
    planId: "start",
  });
  assert.deepEqual(quote, { amountRub: 239, offerId: "off-1", percent: 20 });
});

test("resolveCheckoutCharge prefers the persisted payment amount over a catalog RPC fallback", () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  const live = parseLiveMailOffer({
    offer_id: "off-1",
    percent: 20,
    expires_at: future,
    target_plan_id: "start",
  });
  assert.deepEqual(
    resolveCheckoutCharge({
      catalogAmount: 299,
      planId: "start",
      persistedAmount: 239,
      persistedOfferId: "off-1",
      liveOffer: live,
      rpcQuote: { amountRub: 299, offerId: null, percent: 0 },
    }),
    { amountRub: 239, offerId: "off-1", percent: 20 },
  );
});

test("resolveCheckoutCharge refuses catalog price when a live start offer exists", () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  const live = parseLiveMailOffer({
    offer_id: "off-1",
    percent: 20,
    expires_at: future,
    target_plan_id: "start",
  });
  assert.throws(
    () =>
      resolveCheckoutCharge({
        catalogAmount: 299,
        planId: "start",
        persistedAmount: 299,
        persistedOfferId: null,
        liveOffer: live,
        rpcQuote: { amountRub: 299, offerId: null, percent: 0 },
      }),
    (error: unknown) =>
      error instanceof CheckoutOfferNotAppliedError &&
      error.expectedAmount === 239 &&
      error.actualAmount === 299,
  );
});

test("resolveCheckoutCharge keeps catalog when the offer is for another plan", () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  const live = parseLiveMailOffer({
    offer_id: "off-1",
    percent: 20,
    expires_at: future,
    target_plan_id: "start",
  });
  assert.deepEqual(
    resolveCheckoutCharge({
      catalogAmount: 469,
      planId: "plus",
      persistedAmount: 469,
      persistedOfferId: null,
      liveOffer: live,
      rpcQuote: { amountRub: 469, offerId: null, percent: 0 },
    }),
    { amountRub: 469, offerId: null, percent: 0 },
  );
});

test("parseLiveMailOffer ignores expired or empty grants", () => {
  assert.equal(parseLiveMailOffer(null), null);
  assert.equal(
    parseLiveMailOffer({ percent: 10, expires_at: new Date(Date.now() - 1000).toISOString() }),
    null,
  );
  const future = new Date(Date.now() + 60_000).toISOString();
  const targeted = parseLiveMailOffer({
    offer_id: "offer-1",
    percent: 20,
    expires_at: future,
    target_plan_id: "start",
    source_template_id: "low_balance_upgrade",
    show_nudge: true,
  });
  assert.deepEqual(targeted, {
    offerId: "offer-1",
    percent: 20,
    expiresAt: future,
    targetPlanId: "start",
    sourceTemplateId: "low_balance_upgrade",
    showNudge: true,
  });
  assert.equal(pricingOfferPercentForPlan(targeted, "trial"), null);
  assert.equal(pricingOfferPercentForPlan(targeted, "start"), 20);

  assert.deepEqual(parseLiveMailOffer({
    offer_id: "offer-2",
    percent: 25,
    expires_at: future,
  }), {
    offerId: "offer-2",
    percent: 25,
    expiresAt: future,
    targetPlanId: null,
    sourceTemplateId: null,
    showNudge: false,
  });
  assert.equal(
    pricingOfferPercentForPlan(
      parseLiveMailOffer({
        offer_id: "offer-2",
        percent: 25,
        expires_at: future,
      }),
      "trial",
    ),
    25,
  );
});
