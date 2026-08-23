import assert from "node:assert/strict";
import test from "node:test";
import {
  YANDEX_CONVERSION_CLAIM_STALE_MS,
  YANDEX_CONVERSION_MAX_RETRY_ATTEMPTS,
  buildYandexPurchaseCollectParams,
  flushUnsentYandexPurchaseConversions,
  isYandexConversionClaimOpen,
  reportYandexPurchase,
  yandexConversionClaimMatch,
  yandexConversionIdMatch,
  type ConversionPayment,
} from "./yandex-metrika-measurement";
import { YANDEX_METRIKA_COUNTER_ID, YM_GOAL_PURCHASE } from "./yandex-metrika";

const PAYMENT: ConversionPayment = {
  id: "76bc3cac-6d13-4714-ada0-080747b98830",
  plan_id: "trial",
  credits: 30,
  amount_rub: 99,
  ym_client_id: "1710232430899999999",
  yandex_conversion_sent_at: null,
  yandex_conversion_claimed_at: null,
  yandex_conversion_attempts: 0,
};

type RecordedUpdate = {
  table: string;
  patch: Record<string, unknown>;
  filters: Array<[string, string, unknown]>;
  or: string | null;
};

function createRecordingSupabase(input?: {
  claimData?: { id: string } | null;
  claimError?: { message: string } | null;
  unsent?: ConversionPayment[];
}) {
  const updates: RecordedUpdate[] = [];
  const fromCalls: string[] = [];
  return {
    updates,
    fromCalls,
    from(table: string) {
      fromCalls.push(table);
      const state: RecordedUpdate = {
        table,
        patch: {},
        filters: [],
        or: null,
      };
      const query = {
        select() {
          return query;
        },
        update(patch: Record<string, unknown>) {
          state.patch = patch;
          return query;
        },
        eq(column: string, value: unknown) {
          state.filters.push(["eq", column, value]);
          return query;
        },
        is(column: string, value: unknown) {
          state.filters.push(["is", column, value]);
          return query;
        },
        lt(column: string, value: unknown) {
          state.filters.push(["lt", column, value]);
          return query;
        },
        not(column: string, op: string, value: unknown) {
          state.filters.push(["not", column, `${op}:${value}`]);
          return query;
        },
        or(expr: string) {
          state.or = expr;
          return query;
        },
        order() {
          return query;
        },
        limit() {
          return query;
        },
        maybeSingle() {
          updates.push({
            ...state,
            filters: [...state.filters],
          });
          return Promise.resolve({
            data: input?.claimData === undefined ? { id: PAYMENT.id } : input.claimData,
            error: input?.claimError ?? null,
          });
        },
        then(
          resolve: (value: { data: ConversionPayment[] | null; error: null }) => unknown,
          reject?: (reason: unknown) => unknown,
        ) {
          if (state.patch && Object.keys(state.patch).length > 0) {
            updates.push({
              ...state,
              filters: [...state.filters],
            });
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
          return Promise.resolve({
            data: input?.unsent ?? [],
            error: null,
          }).then(resolve, reject);
        },
      };
      return query;
    },
  };
}

test("Measurement Protocol purchase params include goal, revenue and order id", () => {
  const params = buildYandexPurchaseCollectParams(
    {
      clientId: "1710232430899999999",
      orderId: "263dd707-e1ee-46d9-9a97-c11ad34c289d",
      revenueRub: 399,
      planId: "start",
      credits: 175,
    },
    "test-token",
  );
  assert.equal(params.get("tid"), String(YANDEX_METRIKA_COUNTER_ID));
  assert.equal(params.get("cid"), "1710232430899999999");
  assert.equal(params.get("t"), "event");
  assert.equal(params.get("ea"), YM_GOAL_PURCHASE);
  assert.equal(params.get("pa"), "purchase");
  assert.equal(params.get("ti"), "263dd707-e1ee-46d9-9a97-c11ad34c289d");
  assert.equal(params.get("tr"), "399");
  assert.equal(params.get("cu"), "RUB");
  assert.equal(params.get("pr1id"), "start");
  assert.equal(params.get("ms"), "test-token");
});

test("claim match never filters the column the PATCH writes", () => {
  assert.deepEqual(yandexConversionClaimMatch(PAYMENT.id), {
    id: PAYMENT.id,
    sentAtIsNull: true,
  });
  assert.deepEqual(yandexConversionIdMatch(PAYMENT.id), { id: PAYMENT.id });
});

test("conversion claim is open only when sent/attempts/lease allow it", () => {
  const nowMs = Date.parse("2026-08-23T03:50:00.000Z");
  assert.equal(
    isYandexConversionClaimOpen({
      sentAt: null,
      claimedAt: null,
      attempts: 0,
      nowMs,
    }),
    true,
  );
  assert.equal(
    isYandexConversionClaimOpen({
      sentAt: "2026-08-23T03:47:58.000Z",
      claimedAt: null,
      attempts: 1,
      nowMs,
    }),
    false,
  );
  assert.equal(
    isYandexConversionClaimOpen({
      sentAt: null,
      claimedAt: null,
      attempts: YANDEX_CONVERSION_MAX_RETRY_ATTEMPTS,
      nowMs,
    }),
    false,
  );
  assert.equal(
    isYandexConversionClaimOpen({
      sentAt: null,
      claimedAt: "2026-08-23T03:49:30.000Z",
      attempts: 1,
      nowMs,
    }),
    false,
  );
  assert.equal(
    isYandexConversionClaimOpen({
      sentAt: null,
      claimedAt: new Date(nowMs - YANDEX_CONVERSION_CLAIM_STALE_MS - 1).toISOString(),
      attempts: 1,
      nowMs,
    }),
    true,
  );
});

test("report claims without filtering claimed_at or using or()", async () => {
  const supabase = createRecordingSupabase();
  const sent: string[] = [];
  await reportYandexPurchase(
    supabase as never,
    PAYMENT,
    "landing_yookassa_payments",
    {
      token: "mp-token",
      send: async (payload) => {
        sent.push(payload.orderId);
        return { ok: true };
      },
    },
  );

  assert.deepEqual(sent, [PAYMENT.id]);
  const claim = supabase.updates[0];
  assert.equal(claim.or, null);
  assert.ok("yandex_conversion_claimed_at" in claim.patch);
  assert.deepEqual(claim.filters, [
    ["eq", "id", PAYMENT.id],
    ["is", "yandex_conversion_sent_at", null],
  ]);

  const mark = supabase.updates[1];
  assert.ok("yandex_conversion_sent_at" in mark.patch);
  assert.equal(mark.or, null);
  assert.deepEqual(mark.filters, [["eq", "id", PAYMENT.id]]);
  assert.equal(
    mark.filters.some((filter) => filter[1] === "yandex_conversion_sent_at"),
    false,
  );
  assert.equal(
    mark.filters.some((filter) => filter[1] === "yandex_conversion_claimed_at"),
    false,
  );
});

test("report without token does not claim or increment attempts", async () => {
  const supabase = createRecordingSupabase();
  await reportYandexPurchase(
    supabase as never,
    PAYMENT,
    "landing_yookassa_payments",
    {
      token: null,
      send: async () => {
        throw new Error("should not send");
      },
    },
  );
  assert.equal(supabase.updates.length, 0);
});

test("report skips a fresh in-memory lease without touching the ledger", async () => {
  const supabase = createRecordingSupabase();
  await reportYandexPurchase(
    supabase as never,
    {
      ...PAYMENT,
      yandex_conversion_claimed_at: "2026-08-23T03:49:30.000Z",
      yandex_conversion_attempts: 1,
    },
    "landing_yookassa_payments",
    {
      nowMs: Date.parse("2026-08-23T03:50:00.000Z"),
      token: "mp-token",
      send: async () => {
        throw new Error("should not send");
      },
    },
  );
  assert.equal(supabase.updates.length, 0);
});

test("unsent flush reads both ledgers without PostgREST or()", async () => {
  const supabase = createRecordingSupabase({
    unsent: [PAYMENT],
  });
  const summary = await flushUnsentYandexPurchaseConversions(supabase as never, {
    nowMs: Date.parse("2026-08-23T03:50:00.000Z"),
    limit: 5,
  });
  assert.equal(summary.scanned >= 1, true);
  assert.equal(summary.reported >= 1, true);
  assert.equal(
    supabase.fromCalls.includes("landing_yookassa_payments"),
    true,
  );
  assert.equal(
    supabase.fromCalls.includes("landing_robokassa_payments"),
    true,
  );
  assert.equal(
    supabase.updates.some((update) => update.or),
    false,
  );
});
