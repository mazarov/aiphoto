import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPaymentTrafficSource,
  parseAdminPaymentAttributionFilter,
  parseAdminPaymentStatus,
  parseAdminPaymentTestFilter,
  paymentTestFilterToRpc,
  resolvePaymentCreditState,
} from "./admin-payments";

test("admin attribution filters are bounded and sanitized", () => {
  assert.equal(parseAdminPaymentAttributionFilter(null), null);
  assert.equal(parseAdminPaymentAttributionFilter("  yandex\u0000 "), "yandex");
  assert.equal(parseAdminPaymentAttributionFilter("x".repeat(80)), "x".repeat(64));
});

test("payment source formatter identifies Yandex Direct", () => {
  assert.deepEqual(formatPaymentTrafficSource({
    utm_source: "ya",
    utm_medium: "cpc",
    utm_campaign: "123",
    utm_content: "456.premium.1",
    utm_landing_path: "/generaciya-foto",
  }), {
    primary: "ya / cpc",
    campaign: "123 · 456.premium.1",
    landingPath: "/generaciya-foto",
    isDirect: true,
  });
  assert.deepEqual(formatPaymentTrafficSource({
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_landing_path: null,
  }), {
    primary: "Не указан",
    campaign: null,
    landingPath: null,
    isDirect: false,
  });
});

test("admin payment filters reject unsupported values", () => {
  assert.equal(parseAdminPaymentStatus(null), "all");
  assert.equal(parseAdminPaymentStatus("SUCCEEDED"), "succeeded");
  assert.equal(parseAdminPaymentStatus("refunded"), null);
  assert.equal(parseAdminPaymentTestFilter(null), "all");
  assert.equal(parseAdminPaymentTestFilter("LIVE"), "live");
  assert.equal(parseAdminPaymentTestFilter("sandbox"), null);
  assert.equal(paymentTestFilterToRpc("all"), null);
  assert.equal(paymentTestFilterToRpc("live"), false);
  assert.equal(paymentTestFilterToRpc("test"), true);
});

test("successful payment without credited_at is a discrepancy", () => {
  const now = Date.parse("2026-08-12T12:00:00.000Z");
  assert.equal(
    resolvePaymentCreditState({
      status: "succeeded",
      credited_at: null,
      created_at: "2026-08-12T11:00:00.000Z",
    }, now),
    "discrepancy",
  );
  assert.equal(
    resolvePaymentCreditState({
      status: "pending",
      credited_at: null,
      created_at: "2026-08-12T11:50:00.000Z",
    }, now),
    "not_due",
  );
  assert.equal(
    resolvePaymentCreditState({
      status: "pending",
      credited_at: null,
      created_at: "2026-08-12T11:40:00.000Z",
    }, now),
    "stale",
  );
  assert.equal(
    resolvePaymentCreditState({
      status: "created",
      credited_at: null,
      created_at: "2026-08-12T11:00:00.000Z",
    }, now),
    "stale",
  );
  assert.equal(resolvePaymentCreditState({
    status: "succeeded",
    credited_at: "2026-08-10T07:00:00.000Z",
    created_at: "2026-08-10T06:59:00.000Z",
  }, now), "credited");
});
