import assert from "node:assert/strict";
import test from "node:test";
import { getPricingPlan } from "./pricing-plans";
import {
  buildRobokassaCheckoutPayload,
  formatRobokassaAmount,
  getRobokassaConfig,
  hashRobokassaSignature,
  parseRobokassaResult,
  robokassaAmountsEqual,
  type RobokassaConfig,
  verifyRobokassaResult,
} from "./robokassa-core";

const config: RobokassaConfig = {
  merchantLogin: "promptshot-test",
  password1: "password-one",
  password2: "password-two",
  hashAlgorithm: "md5",
  testMode: true,
  receiptTax: "none",
};

test("formats RUB with a stable two-decimal representation", () => {
  assert.equal(formatRobokassaAmount(199), "199.00");
  assert.equal(robokassaAmountsEqual("199.000000", 199), true);
  assert.equal(robokassaAmountsEqual("199.01", 199), false);
  assert.throws(() => formatRobokassaAmount(0), /Invalid/);
});

test("supports configured Robokassa hash algorithms", () => {
  assert.equal(
    hashRobokassaSignature("test", "md5"),
    "098f6bcd4621d373cade4e832627b4f6",
  );
  assert.equal(
    hashRobokassaSignature("test", "sha256"),
    "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  );
});

test("test mode selects separate Robokassa passwords", () => {
  const previous = { ...process.env };
  try {
    process.env.ROBOKASSA_MERCHANT_LOGIN = "merchant";
    process.env.ROBOKASSA_PASSWORD_1 = "live-one";
    process.env.ROBOKASSA_PASSWORD_2 = "live-two";
    process.env.ROBOKASSA_TEST_PASSWORD_1 = "test-one";
    process.env.ROBOKASSA_TEST_PASSWORD_2 = "test-two";
    process.env.ROBOKASSA_TEST_MODE = "1";
    const selected = getRobokassaConfig();
    assert.equal(selected.password1, "test-one");
    assert.equal(selected.password2, "test-two");
    assert.equal(selected.testMode, true);
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in previous)) delete process.env[key];
    }
    Object.assign(process.env, previous);
  }
});

test("checkout payload is server-priced, fiscalized and modal", () => {
  const plan = getPricingPlan("trial");
  assert.ok(plan);
  const payload = buildRobokassaCheckoutPayload({
    paymentId: "263dd707-e1ee-46d9-9a97-c11ad34c289d",
    invoiceId: 42,
    plan,
    config,
  });
  assert.equal(payload.OutSum, "199.00");
  assert.equal(payload.InvId, 42);
  assert.equal(payload.IsTest, 1);
  assert.deepEqual(JSON.parse(payload.Settings), {
    Mode: "modal",
  });
  const receipt = JSON.parse(decodeURIComponent(payload.Receipt));
  assert.equal(receipt.items[0].sum, 199);
  assert.equal(typeof receipt.items[0].sum, "number");
  assert.equal(receipt.items[0].payment_object, "service");
});

test("ResultURL signature includes sorted Shp parameters and rejects tampering", () => {
  const outSum = "399.000000";
  const invoiceId = 73;
  const paymentId = "263dd707-e1ee-46d9-9a97-c11ad34c289d";
  const signature = hashRobokassaSignature(
    `${outSum}:${invoiceId}:${config.password2}:Shp_a=first:Shp_payment_id=${paymentId}`,
    config.hashAlgorithm,
  );
  const params = new URLSearchParams({
    OutSum: outSum,
    InvId: String(invoiceId),
    SignatureValue: signature.toUpperCase(),
    Shp_payment_id: paymentId,
    Shp_a: "first",
    PaymentMethod: "BankCard",
  });
  const result = parseRobokassaResult(params);
  assert.equal(verifyRobokassaResult(result, config), true);
  assert.equal(result.paymentMethod, "BankCard");

  params.set("OutSum", "499.000000");
  assert.equal(verifyRobokassaResult(parseRobokassaResult(params), config), false);
});
