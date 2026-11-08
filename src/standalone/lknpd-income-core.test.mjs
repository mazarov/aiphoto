import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildIncomePayload,
  buildServiceName,
  classifyAdminPaymentRow,
  classifyAdminPayments,
  findIncomeByPaymentId,
  incomesDateRange,
  journalPut,
  parseDelimitedCsv,
  parseJournal,
  paymentIdMarker,
  planTitle,
  summarizeClassified,
  toMoscowIso,
} from "./lknpd-income-core.mjs";

const dir = dirname(fileURLToPath(import.meta.url));

const HEADER =
  "created_at;payer_email;payer_name;payer_provider;auth_user_id;landing_user_id;identity_mismatch;plan_id;paywall_variant;amount_rub;credits;test;status;provider;provider_status;provider_payment_id;credit_state;credited_at;source;utm_source;utm_medium;utm_campaign;utm_content;utm_term;utm_landing_path;yclid;visitor_id;session_id;id";

function csvRow(overrides = {}) {
  const row = {
    created_at: "2026-09-18T10:00:00.000Z",
    payer_email: "buyer@example.com",
    payer_name: "Buyer",
    payer_provider: "yandex",
    auth_user_id: "auth-1",
    landing_user_id: "land-1",
    identity_mismatch: "false",
    plan_id: "start",
    paywall_variant: "treatment",
    amount_rub: "299",
    credits: "100",
    test: "false",
    status: "succeeded",
    provider: "yookassa",
    provider_status: "succeeded",
    provider_payment_id: "yk-1",
    credit_state: "credited",
    credited_at: "2026-09-18T10:05:00.000Z",
    source: "yandex",
    utm_source: "yandex",
    utm_medium: "cpc",
    utm_campaign: "",
    utm_content: "",
    utm_term: "",
    utm_landing_path: "/",
    yclid: "",
    visitor_id: "",
    session_id: "",
    id: "11111111-1111-1111-1111-111111111111",
    ...overrides,
  };
  return [
    row.created_at,
    row.payer_email,
    row.payer_name,
    row.payer_provider,
    row.auth_user_id,
    row.landing_user_id,
    row.identity_mismatch,
    row.plan_id,
    row.paywall_variant,
    row.amount_rub,
    row.credits,
    row.test,
    row.status,
    row.provider,
    row.provider_status,
    row.provider_payment_id,
    row.credit_state,
    row.credited_at,
    row.source,
    row.utm_source,
    row.utm_medium,
    row.utm_campaign,
    row.utm_content,
    row.utm_term,
    row.utm_landing_path,
    row.yclid,
    row.visitor_id,
    row.session_id,
    row.id,
  ].join(";");
}

test("parses admin CSV with BOM, quotes and semicolon inside a name", () => {
  const csv = `\uFEFF${HEADER}\n${csvRow({
    payer_name: '"Иванов; Иван"',
  })}`;
  const { records } = parseDelimitedCsv(csv);
  assert.equal(records.length, 1);
  assert.equal(records[0].plan_id, "start");
  assert.equal(records[0].payer_name, "Иванов; Иван");
  assert.equal(records[0].amount_rub, "299");
});

test("ready row becomes ACCOUNT income for a Moscow calendar time", () => {
  const row = parseDelimitedCsv(`${HEADER}\n${csvRow()}`).records[0];
  const payload = buildIncomePayload(row, new Date("2026-09-19T12:00:00.000Z"));
  assert.equal(payload.paymentType, "ACCOUNT");
  assert.equal(payload.client.incomeType, "FROM_INDIVIDUAL");
  assert.equal(payload.totalAmount, "299");
  assert.equal(payload.operationTime, "2026-09-18T13:05:00+03:00");
  assert.equal(payload.requestTime, "2026-09-19T15:00:00+03:00");
  assert.equal(
    payload.services[0].name,
    "PromptShot · Оптимальный · 100 ток. #ps:11111111-1111-1111-1111-111111111111",
  );
});

test("control paywall uses catalog titles, unknown plan keeps id", () => {
  assert.equal(planTitle("pro", "control"), "Про");
  assert.equal(planTitle("start", "treatment"), "Оптимальный");
  assert.equal(planTitle("legacy", "treatment"), "legacy");
  const row = parseDelimitedCsv(
    `${HEADER}\n${csvRow({ plan_id: "legacy", paywall_variant: "", credits: "10" })}`,
  ).records[0];
  assert.match(buildServiceName(row), /PromptShot · legacy · 10 ток\. #ps:/);
});

test("classifier drops test, canceled and journal/FNS duplicates", () => {
  const ready = parseDelimitedCsv(`${HEADER}\n${csvRow()}`).records[0];
  const testRow = parseDelimitedCsv(
    `${HEADER}\n${csvRow({ id: "22222222-2222-2222-2222-222222222222", test: "true" })}`,
  ).records[0];
  const canceled = parseDelimitedCsv(
    `${HEADER}\n${csvRow({ id: "33333333-3333-3333-3333-333333333333", status: "canceled" })}`,
  ).records[0];
  const journal = journalPut(parseJournal(null), ready.id, {
    receiptUuid: "journal-uuid",
  });
  const classified = classifyAdminPayments(
    [
      ready,
      testRow,
      canceled,
      parseDelimitedCsv(
        `${HEADER}\n${csvRow({ id: "44444444-4444-4444-4444-444444444444" })}`,
      ).records[0],
    ],
    {
      journal,
      incomes: [
        {
          approvedReceiptUuid: "fns-uuid",
          services: [
            {
              name: `PromptShot · Оптимальный · 100 ток. ${paymentIdMarker(
                "44444444-4444-4444-4444-444444444444",
              )}`,
            },
          ],
        },
      ],
    },
  );
  assert.deepEqual(
    classified.map((item) => item.kind),
    ["skip_journal", "skip_test", "skip_status", "skip_fns"],
  );
  const summary = summarizeClassified(classified);
  assert.equal(summary.ready, 0);
  assert.equal(summary.skip_journal, 1);
  assert.equal(summary.skip_fns, 1);
});

test("credited_at wins over created_at; empty credited_at falls back", () => {
  const withCredit = classifyAdminPaymentRow(
    parseDelimitedCsv(`${HEADER}\n${csvRow()}`).records[0],
  );
  assert.equal(withCredit.kind, "ready");
  assert.equal(withCredit.operationTime, "2026-09-18T13:05:00+03:00");

  const fallback = classifyAdminPaymentRow(
    parseDelimitedCsv(
      `${HEADER}\n${csvRow({ credited_at: "", created_at: "2026-09-18T21:00:00.000Z" })}`,
    ).records[0],
  );
  assert.equal(fallback.kind, "ready");
  assert.equal(fallback.operationTime, "2026-09-19T00:00:00+03:00");
});

test("FNS list match ignores cancelled receipts", () => {
  const id = "55555555-5555-5555-5555-555555555555";
  const found = findIncomeByPaymentId(
    [
      {
        approvedReceiptUuid: "old",
        cancellationInfo: { comment: "mistake" },
        services: [{ name: `x ${paymentIdMarker(id)}` }],
      },
      {
        approvedReceiptUuid: "live",
        services: [{ name: `PromptShot ${paymentIdMarker(id)}` }],
      },
    ],
    id,
  );
  assert.equal(found.approvedReceiptUuid, "live");
});

test("fixture HTML CSV rows keep payment id in the last column", () => {
  const html = readFileSync(join(dir, "lknpd-income-fixture.html"), "utf8");
  const live = html.match(/const live = "([^"]+)"/)[1];
  const { records } = parseDelimitedCsv(`${HEADER}\n${live}`);
  assert.equal(records[0].id, "11111111-1111-1111-1111-111111111111");
  assert.equal(records[0].plan_id, "start");
  assert.equal(classifyAdminPaymentRow(records[0]).kind, "ready");
});

test("incomes range covers CSV dates with one-day padding", () => {
  const records = parseDelimitedCsv(
    `${HEADER}\n${csvRow()}\n${csvRow({
      id: "66666666-6666-6666-6666-666666666666",
      credited_at: "2026-09-10T08:00:00.000Z",
    })}`,
  ).records;
  const range = incomesDateRange(records, new Date("2026-09-19T12:00:00.000Z"));
  assert.equal(toMoscowIso(new Date("2026-09-09T08:00:00.000Z")), range.from);
  assert.ok(range.to.startsWith("2026-09-20"));
});
