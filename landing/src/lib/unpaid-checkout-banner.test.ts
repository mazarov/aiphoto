import assert from "node:assert/strict";
import test from "node:test";
import {
  UNPAID_BANNER_DISCOUNT_AFTER_MS,
  UNPAID_BANNER_TTL_MS,
  YK_ABANDON_FLASH_DUE_MS,
  YK_ABANDON_FLASH_TTL_MS,
  formatUnpaidBannerCountdown,
  isSafeYooKassaConfirmationUrl,
  isUnpaidBannerPathHidden,
  pickLatestUnpaidLedgerRow,
  resolveUnpaidBanner,
  unpaidBannerCopy,
} from "./unpaid-checkout-banner";

const createdAt = "2026-08-30T10:00:00.000Z";
const createdMs = Date.parse(createdAt);

function snap(overrides: Record<string, unknown> = {}) {
  return {
    provider: "yookassa" as const,
    paymentId: "pay-1",
    planId: "trial",
    credits: 70,
    createdAt,
    creditedAt: null,
    status: "pending",
    offer: null,
    ...overrides,
  };
}

test("banner is hidden after 24h, credit, dismiss, or live payment query", () => {
  assert.equal(
    resolveUnpaidBanner({
      nowMs: createdMs + UNPAID_BANNER_TTL_MS,
      snapshot: snap(),
    }).visible,
    false,
  );
  assert.equal(
    resolveUnpaidBanner({
      nowMs: createdMs + 60_000,
      snapshot: snap({ creditedAt: "2026-08-30T10:01:00.000Z" }),
    }).visible,
    false,
  );
  assert.equal(
    resolveUnpaidBanner({
      nowMs: createdMs + 60_000,
      snapshot: snap(),
      dismissedPaymentId: "pay-1",
    }).visible,
    false,
  );
  assert.equal(
    resolveUnpaidBanner({
      nowMs: createdMs + 60_000,
      snapshot: snap(),
      paymentQueryPresent: true,
    }).visible,
    false,
  );
  assert.equal(
    resolveUnpaidBanner({
      nowMs: createdMs + 60_000,
      snapshot: snap({ status: "succeeded" }),
    }).visible,
    false,
  );
});

test("first 15 minutes stay on unfinished copy even if the flash grant already exists", () => {
  const grantExpires = new Date(createdMs + YK_ABANDON_FLASH_DUE_MS + YK_ABANDON_FLASH_TTL_MS).toISOString();
  const view = resolveUnpaidBanner({
    nowMs: createdMs + 6 * 60 * 1000,
    snapshot: snap({
      offer: { percent: 25, expiresAt: grantExpires },
    }),
  });
  assert.equal(view.visible, true);
  if (!view.visible) return;
  assert.equal(view.phase, "unpaid");
  assert.equal(unpaidBannerCopy(view).message, "Незавершенная оплата: 70 токенов");
});

test("flash copy after 15 minutes uses remaining grant time from the email TTL", () => {
  const grantStart = createdMs + YK_ABANDON_FLASH_DUE_MS;
  const grantExpires = grantStart + YK_ABANDON_FLASH_TTL_MS;
  const nowMs = createdMs + UNPAID_BANNER_DISCOUNT_AFTER_MS;
  const view = resolveUnpaidBanner({
    nowMs,
    snapshot: snap({
      offer: { percent: 25, expiresAt: new Date(grantExpires).toISOString() },
    }),
  });
  assert.equal(view.visible, true);
  if (!view.visible) return;
  assert.equal(view.phase, "flash");
  assert.equal(view.remainingMs, 50 * 60 * 1000);
  assert.equal(formatUnpaidBannerCountdown(view.remainingMs ?? 0), "50:00");
  assert.match(unpaidBannerCopy(view).message, /скидку 25%/);
});

test("10/20 percent lifecycle grants do not switch the bar to the 25 percent flash", () => {
  const view = resolveUnpaidBanner({
    nowMs: createdMs + 40 * 60 * 1000,
    snapshot: snap({
      offer: {
        percent: 10,
        expiresAt: new Date(createdMs + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    }),
  });
  assert.equal(view.visible, true);
  if (!view.visible) return;
  assert.equal(view.phase, "unpaid");
});

test("flash falls back to unfinished after the one-hour grant ends, until 24h", () => {
  const grantExpires = createdMs + YK_ABANDON_FLASH_DUE_MS + YK_ABANDON_FLASH_TTL_MS;
  const view = resolveUnpaidBanner({
    nowMs: grantExpires + 1000,
    snapshot: snap({
      offer: { percent: 25, expiresAt: new Date(grantExpires).toISOString() },
    }),
  });
  assert.equal(view.visible, true);
  if (!view.visible) return;
  assert.equal(view.phase, "unpaid");
});

test("admin, embed, and payment-return routes hide the bar", () => {
  assert.equal(isUnpaidBannerPathHidden("/admin/payments"), true);
  assert.equal(isUnpaidBannerPathHidden("/embed/stv"), true);
  assert.equal(isUnpaidBannerPathHidden("/payment/robokassa/success"), true);
  assert.equal(isUnpaidBannerPathHidden("/generaciya-foto"), false);
});

test("pickLatestUnpaidLedgerRow prefers newer live row across providers", () => {
  const nowMs = createdMs + 10 * 60 * 1000;
  const picked = pickLatestUnpaidLedgerRow(
    [
      {
        provider: "yookassa",
        paymentId: "yk-old",
        planId: "trial",
        credits: 70,
        createdAt: createdAt,
        creditedAt: null,
        status: "canceled",
      },
      {
        provider: "robokassa",
        paymentId: "rk-new",
        planId: "trial",
        credits: 70,
        createdAt: new Date(createdMs + 60_000).toISOString(),
        creditedAt: null,
        status: "pending",
      },
      {
        provider: "robokassa",
        paymentId: "rk-paid",
        planId: "pro",
        credits: 175,
        createdAt: new Date(createdMs + 120_000).toISOString(),
        creditedAt: new Date(createdMs + 130_000).toISOString(),
        status: "succeeded",
      },
    ],
    nowMs,
  );
  assert.equal(picked?.paymentId, "rk-new");
  assert.equal(picked?.provider, "robokassa");
});

test("only hosted YooKassa https URLs are safe to open from the bar", () => {
  assert.equal(
    isSafeYooKassaConfirmationUrl("https://yoomoney.ru/checkout/payments/v2/contract?orderId=1"),
    true,
  );
  assert.equal(isSafeYooKassaConfirmationUrl("https://evil.test/checkout"), false);
  assert.equal(isSafeYooKassaConfirmationUrl("/pricing?plan=trial"), false);
});
