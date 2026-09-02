import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyRobokassaParentRedirect,
  createRobokassaReturnMessage,
  DEFAULT_ROBOKASSA_RETURN_PATH,
  isRobokassaPaymentPath,
  isRobokassaProviderOrigin,
  isRobokassaReturnMessage,
  readRobokassaRedirectUrl,
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

test("parent redirect from Robokassa State stays on PromptShot", () => {
  const site = "https://promptshot.ru";
  assert.equal(isRobokassaProviderOrigin("https://auth.robokassa.ru"), true);
  assert.equal(isRobokassaProviderOrigin("https://promptshot.ru"), false);
  assert.equal(readRobokassaRedirectUrl({ action: "closeRobokassaFrame" }), null);
  assert.equal(
    classifyRobokassaParentRedirect(
      "https://promptshot.ru/payment/robokassa/success",
      site,
    ),
    "close",
  );
  assert.equal(
    classifyRobokassaParentRedirect(
      "https://auth.robokassa.ru/Merchant/State/19303FBE-86CC-4BDD-9A14-70CD6012E1EB-DDic5K5Yqy",
      site,
    ),
    "keep-iframe",
  );
  assert.equal(
    classifyRobokassaParentRedirect("https://securepay.tinkoff.ru/acs", site),
    "allow",
  );
  assert.equal(classifyRobokassaParentRedirect("", site), "close");
});
