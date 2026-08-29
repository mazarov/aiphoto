import assert from "node:assert/strict";
import test from "node:test";
import { applyCheckoutOffer, parseLiveMailOffer } from "./mail-checkout-offer";
import type { MailRpcClient } from "./mail-outbox";

test("applyCheckoutOffer uses the locked grant amount", async () => {
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

test("parseLiveMailOffer ignores expired or empty grants", () => {
  assert.equal(parseLiveMailOffer(null), null);
  assert.equal(
    parseLiveMailOffer({ percent: 10, expires_at: new Date(Date.now() - 1000).toISOString() }),
    null,
  );
  const future = new Date(Date.now() + 60_000).toISOString();
  assert.deepEqual(parseLiveMailOffer({ percent: 20, expires_at: future }), {
    percent: 20,
    expiresAt: future,
  });
  assert.deepEqual(parseLiveMailOffer({ percent: 25, expires_at: future }), {
    percent: 25,
    expiresAt: future,
  });
});
