import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAdminPaymentStatus,
  parseAdminPaymentTestFilter,
  paymentTestFilterToRpc,
  resolvePaymentCreditState,
} from "./admin-payments";

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
