import assert from "node:assert/strict";
import test from "node:test";
import {
  buildYooKassaReturnUrl,
  DEFAULT_YOOKASSA_RETURN_PATH,
  isYooKassaPaymentId,
  sanitizeYooKassaReturnPath,
} from "./yookassa-return-path";

const PAYMENT_ID = "263dd707-e1ee-46d9-9a97-c11ad34c289d";

test("keeps listing origin and strips a prior payment query", () => {
  assert.equal(
    sanitizeYooKassaReturnPath("/promty-dlya-foto-devushki?payment=old"),
    "/promty-dlya-foto-devushki",
  );
  assert.equal(
    sanitizeYooKassaReturnPath("/generaciya-foto?sort=new"),
    "/generaciya-foto?sort=new",
  );
  assert.equal(sanitizeYooKassaReturnPath("/"), "/");
});

test("rejects open redirects and auth/api callbacks", () => {
  assert.equal(
    sanitizeYooKassaReturnPath("https://evil.test/x"),
    DEFAULT_YOOKASSA_RETURN_PATH,
  );
  assert.equal(
    sanitizeYooKassaReturnPath("//evil.test"),
    DEFAULT_YOOKASSA_RETURN_PATH,
  );
  assert.equal(
    sanitizeYooKassaReturnPath("/api/payments/yookassa/create"),
    DEFAULT_YOOKASSA_RETURN_PATH,
  );
  assert.equal(
    sanitizeYooKassaReturnPath("/auth/callback"),
    DEFAULT_YOOKASSA_RETURN_PATH,
  );
});

test("builds return URL on the origin path, not always /pricing", () => {
  assert.equal(
    buildYooKassaReturnUrl({
      siteUrl: "https://promptshot.ru",
      localPaymentId: PAYMENT_ID,
      returnPath: "/promty-dlya-foto-par",
      preserveTestAccess: false,
    }),
    `https://promptshot.ru/promty-dlya-foto-par?payment=${PAYMENT_ID}`,
  );
  assert.equal(
    buildYooKassaReturnUrl({
      siteUrl: "https://promptshot.ru",
      localPaymentId: PAYMENT_ID,
      returnPath: null,
      preserveTestAccess: true,
    }),
    `https://promptshot.ru/pricing?test=true&payment=${PAYMENT_ID}`,
  );
});

test("payment id guard", () => {
  assert.equal(isYooKassaPaymentId(PAYMENT_ID), true);
  assert.equal(isYooKassaPaymentId("not-a-uuid"), false);
});
