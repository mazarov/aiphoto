import assert from "node:assert/strict";
import test from "node:test";
import {
  getPaymentProvider,
  getPaymentProviderForEmail,
} from "./payment-provider";

test("payment provider defaults to YooKassa and accepts Robokassa flag", () => {
  const previous = process.env.PAYMENT_PROVIDER;
  const previousCanary = process.env.ROBOKASSA_CANARY_EMAILS;
  try {
    delete process.env.PAYMENT_PROVIDER;
    process.env.ROBOKASSA_CANARY_EMAILS =
      "azarov.maxim@gmail.com, second@example.com";
    assert.equal(getPaymentProvider(), "yookassa");
    assert.equal(
      getPaymentProviderForEmail(" AZAROV.MAXIM@gmail.com "),
      "robokassa",
    );
    assert.equal(getPaymentProviderForEmail("customer@example.com"), "yookassa");
    process.env.PAYMENT_PROVIDER = " ROBOKASSA ";
    assert.equal(getPaymentProvider(), "robokassa");
    assert.equal(getPaymentProviderForEmail("customer@example.com"), "robokassa");
    process.env.PAYMENT_PROVIDER = "unknown";
    assert.throws(() => getPaymentProvider(), /Unsupported PAYMENT_PROVIDER/);
  } finally {
    if (previous === undefined) delete process.env.PAYMENT_PROVIDER;
    else process.env.PAYMENT_PROVIDER = previous;
    if (previousCanary === undefined) delete process.env.ROBOKASSA_CANARY_EMAILS;
    else process.env.ROBOKASSA_CANARY_EMAILS = previousCanary;
  }
});
