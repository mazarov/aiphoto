import assert from "node:assert/strict";
import test from "node:test";
import {
  formatOfferCountdown,
  isLowBalanceNudgeHiddenUntil,
  isLowBalanceUpgradeOffer,
  LOW_BALANCE_NUDGE_DISMISS_MS,
  lowBalanceNudgeBlockedByPath,
  remainingOfferMs,
  rememberLowBalanceNudgeDismissed,
} from "./low-balance-upgrade-nudge";

test("lowBalanceNudgeBlockedByPath hides checkout and admin only", () => {
  assert.equal(lowBalanceNudgeBlockedByPath("/pricing"), true);
  assert.equal(lowBalanceNudgeBlockedByPath("/admin/payments"), true);
  assert.equal(lowBalanceNudgeBlockedByPath("/payment/success"), true);
  assert.equal(lowBalanceNudgeBlockedByPath("/p/some-card"), false);
  assert.equal(lowBalanceNudgeBlockedByPath("/generations"), false);
  assert.equal(lowBalanceNudgeBlockedByPath("/generate"), false);
  assert.equal(lowBalanceNudgeBlockedByPath("/foto-v-promt"), false);
});

test("lowBalanceNudgeBlockedByPath stays on listing and SEO hubs", () => {
  assert.equal(lowBalanceNudgeBlockedByPath("/"), false);
  assert.equal(lowBalanceNudgeBlockedByPath("/catalog"), false);
  assert.equal(lowBalanceNudgeBlockedByPath("/generaciya-foto"), false);
  assert.equal(lowBalanceNudgeBlockedByPath("/ii-fotosessiya"), false);
  assert.equal(lowBalanceNudgeBlockedByPath("/privacy"), false);
});

test("dismiss hides the nudge for 24 hours, then it can show again", () => {
  const now = Date.parse("2026-09-07T12:00:00.000Z");
  const until = now + LOW_BALANCE_NUDGE_DISMISS_MS;
  assert.equal(isLowBalanceNudgeHiddenUntil(null, now), false);
  assert.equal(isLowBalanceNudgeHiddenUntil(until, now), true);
  assert.equal(isLowBalanceNudgeHiddenUntil(until, until), false);
  assert.equal(isLowBalanceNudgeHiddenUntil(until, until + 1), false);
  assert.equal(rememberLowBalanceNudgeDismissed("offer-1", now), until);
});

test("formatOfferCountdown uses H:MM:SS within a 24h window", () => {
  assert.equal(formatOfferCountdown(0), "0:00:00");
  assert.equal(formatOfferCountdown(1_000), "0:00:01");
  assert.equal(formatOfferCountdown(61_000), "0:01:01");
  assert.equal(formatOfferCountdown(3_661_000), "1:01:01");
  assert.equal(formatOfferCountdown(24 * 60 * 60 * 1000 - 1_000), "23:59:59");
});

test("remainingOfferMs clamps expired grants to zero", () => {
  const now = Date.parse("2026-09-07T18:00:00.000Z");
  assert.equal(remainingOfferMs("2026-09-07T17:00:00.000Z", now), 0);
  assert.equal(remainingOfferMs("2026-09-07T19:00:00.000Z", now), 3_600_000);
});

test("isLowBalanceUpgradeOffer accepts only the start 20% grant", () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  assert.equal(
    isLowBalanceUpgradeOffer({
      offerId: "o1",
      percent: 20,
      expiresAt: future,
      targetPlanId: "start",
      sourceTemplateId: "low_balance_upgrade",
      showNudge: false,
    }),
    true,
  );
  assert.equal(
    isLowBalanceUpgradeOffer({
      offerId: "o2",
      percent: 25,
      expiresAt: future,
      targetPlanId: null,
      sourceTemplateId: "yk_abandon_5m",
      showNudge: true,
    }),
    false,
  );
});
