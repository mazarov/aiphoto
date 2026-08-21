import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_PAYMENT_CSV_BOM,
  ADMIN_PAYMENT_CSV_COLUMNS,
  ADMIN_PAYMENT_CSV_SEPARATOR,
  escapeAdminPaymentCsvCell,
  formatPaymentTrafficSource,
  parseAdminPaymentAttributionFilter,
  parseAdminPaymentFormat,
  parseAdminPaymentStatus,
  parseAdminPaymentTestFilter,
  paymentTestFilterToRpc,
  resolvePaymentCreditState,
  serializeAdminPaymentsCsv,
  toAdminPaymentItem,
  type AdminPaymentItem,
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

test("admin payment format accepts json and csv", () => {
  assert.equal(parseAdminPaymentFormat(null), "json");
  assert.equal(parseAdminPaymentFormat("CSV"), "csv");
  assert.equal(parseAdminPaymentFormat("xlsx"), null);
});

test("payment row mapper exposes credit state and identity mismatch", () => {
  const item = toAdminPaymentItem({
    id: "11111111-1111-4111-8111-111111111111",
    provider: "yookassa",
    provider_payment_id: "yk_1",
    created_at: "2026-08-12T11:00:00.000Z",
    updated_at: "2026-08-12T11:01:00.000Z",
    auth_user_id: "22222222-2222-4222-8222-222222222222",
    landing_user_id: "33333333-3333-4333-8333-333333333333",
    payer_email: "payer@example.com",
    payer_display_name: "Payer",
    payer_provider: "google",
    plan_id: "start",
    credits: 175,
    amount_rub: "399",
    status: "succeeded",
    provider_status: "succeeded",
    test: false,
    paywall_variant: "treatment",
    visitor_id: null,
    session_id: null,
    yclid: "yclid-1",
    utm_source: "ya",
    utm_medium: "cpc",
    utm_campaign: "123",
    utm_content: "456.premium.1",
    utm_term: null,
    utm_landing_path: "/generaciya-foto",
    credited_at: null,
  }, Date.parse("2026-08-12T12:00:00.000Z"));
  assert.equal(item.amountRub, 399);
  assert.equal(item.identityMismatch, true);
  assert.equal(item.creditState, "discrepancy");
});

test("payments csv uses BOM, semicolon, and quoted formula-safe cells", () => {
  assert.equal(escapeAdminPaymentCsvCell("=1+1"), "'=1+1");
  assert.equal(escapeAdminPaymentCsvCell('say "hi"; bye'), '"say ""hi""; bye"');
  const item: AdminPaymentItem = {
    id: "11111111-1111-4111-8111-111111111111",
    provider: "robokassa",
    providerPaymentId: "42",
    createdAt: "2026-08-21T10:00:00.000Z",
    updatedAt: "2026-08-21T10:00:00.000Z",
    authUserId: "22222222-2222-4222-8222-222222222222",
    landingUserId: "22222222-2222-4222-8222-222222222222",
    identityMismatch: false,
    payerEmail: "payer@example.com",
    payerDisplayName: "Name; \"quoted\"",
    payerProvider: "yandex",
    planId: "pro",
    amountRub: 899,
    credits: 700,
    status: "succeeded",
    providerStatus: "succeeded",
    test: false,
    paywallVariant: "control",
    visitorId: null,
    sessionId: null,
    yclid: null,
    utmSource: "yandex",
    utmMedium: "cpc",
    utmCampaign: "camp",
    utmContent: null,
    utmTerm: null,
    utmLandingPath: "/pricing",
    creditedAt: "2026-08-21T10:01:00.000Z",
    creditState: "credited",
  };
  const csv = serializeAdminPaymentsCsv([item]);
  assert.equal(csv.startsWith(ADMIN_PAYMENT_CSV_BOM), true);
  assert.equal(csv.includes(ADMIN_PAYMENT_CSV_COLUMNS.join(ADMIN_PAYMENT_CSV_SEPARATOR)), true);
  assert.match(csv, /payer@example\.com/);
  assert.match(csv, /"Name; ""quoted"""/);
  assert.match(csv, /yandex \/ cpc/);
});
