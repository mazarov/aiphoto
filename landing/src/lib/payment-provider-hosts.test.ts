import assert from "node:assert/strict";
import test from "node:test";
import {
  isPaymentProviderHost,
  isRobokassaCheckoutHost,
  isYooKassaCheckoutHost,
} from "./payment-provider-hosts";

test("YooKassa hosted checkout hosts match wallet and API domains", () => {
  assert.equal(isYooKassaCheckoutHost("yoomoney.ru"), true);
  assert.equal(isYooKassaCheckoutHost("www.yoomoney.ru"), true);
  assert.equal(isYooKassaCheckoutHost("checkout.yoomoney.ru"), true);
  assert.equal(isYooKassaCheckoutHost("yookassa.ru"), true);
  assert.equal(isYooKassaCheckoutHost("money.yandex.ru"), true);
  assert.equal(isYooKassaCheckoutHost("evil-yoomoney.ru"), false);
  assert.equal(isYooKassaCheckoutHost("yandex.ru"), false);
});

test("Robokassa and combined PSP matcher", () => {
  assert.equal(isRobokassaCheckoutHost("auth.robokassa.ru"), true);
  assert.equal(isRobokassaCheckoutHost("robokassa.ru"), true);
  assert.equal(isPaymentProviderHost("yoomoney.ru"), true);
  assert.equal(isPaymentProviderHost("t.me"), false);
});
