import assert from "node:assert/strict";
import test from "node:test";
import {
  createRobokassaReturnMessage,
  DEFAULT_ROBOKASSA_RETURN_PATH,
  isRobokassaPaymentPath,
  isRobokassaReturnMessage,
  sanitizeRobokassaReturnPath,
} from "./robokassa-return";

test("return path stays on the pre-checkout PromptShot screen", () => {
  assert.equal(sanitizeRobokassaReturnPath("/generaciya-foto"), "/generaciya-foto");
  assert.equal(
    sanitizeRobokassaReturnPath("/p/studio-portrait?from=pricing"),
    "/p/studio-portrait?from=pricing",
  );
});

test("SuccessURL and FailURL cannot become the return target", () => {
  assert.equal(isRobokassaPaymentPath("/payment/robokassa/success"), true);
  assert.equal(isRobokassaPaymentPath("/payment/robokassa/fail"), true);
  assert.equal(
    sanitizeRobokassaReturnPath("/payment/robokassa/success"),
    DEFAULT_ROBOKASSA_RETURN_PATH,
  );
  assert.equal(sanitizeRobokassaReturnPath("/pricing"), "/pricing");
});

test("return message is same-origin and action-scoped", () => {
  const message = createRobokassaReturnMessage();
  assert.equal(isRobokassaReturnMessage(message), true);
  assert.equal(isRobokassaReturnMessage({ source: message.source }), false);
  assert.equal(isRobokassaReturnMessage({ action: "return" }), false);
  assert.equal(isRobokassaReturnMessage({ source: "robokassa", action: "return" }), false);
});
