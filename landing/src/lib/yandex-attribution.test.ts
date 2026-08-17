import assert from "node:assert/strict";
import test from "node:test";
import {
  readYclidFromSearch,
  resolveFirstTouchYclid,
  sanitizeYclid,
  sanitizeYmClientId,
} from "./yandex-attribution";
import { buildYandexPurchaseCollectParams } from "./yandex-metrika-measurement";
import { YANDEX_METRIKA_COUNTER_ID, YM_GOAL_PURCHASE } from "./yandex-metrika";

test("sanitizeYmClientId accepts Metrika numeric ClientID", () => {
  assert.equal(sanitizeYmClientId("1710232430899999999"), "1710232430899999999");
  assert.equal(sanitizeYmClientId(" 123456 "), "123456");
  assert.equal(sanitizeYmClientId("abc"), null);
  assert.equal(sanitizeYmClientId(""), null);
  assert.equal(sanitizeYmClientId(123456), null);
});

test("sanitizeYclid accepts Direct click ids only", () => {
  assert.equal(sanitizeYclid("14264778086066946047"), "14264778086066946047");
  assert.equal(sanitizeYclid("12345678"), null);
  assert.equal(sanitizeYclid("yclid=1"), null);
});

test("readYclidFromSearch pulls first-touch click id from query", () => {
  assert.equal(
    readYclidFromSearch("?utm_source=yandex&yclid=14264778086066946047"),
    "14264778086066946047",
  );
  assert.equal(readYclidFromSearch("yclid=14264778086066946047"), "14264778086066946047");
  assert.equal(readYclidFromSearch("?utm_source=yandex"), null);
});

test("resolveFirstTouchYclid keeps stored click id over a later URL", () => {
  assert.deepEqual(
    resolveFirstTouchYclid("14264778086066946047", "111111111"),
    { yclid: "111111111", persist: null },
  );
  assert.deepEqual(
    resolveFirstTouchYclid("14264778086066946047", null),
    { yclid: "14264778086066946047", persist: "14264778086066946047" },
  );
  assert.deepEqual(resolveFirstTouchYclid(null, null), {
    yclid: null,
    persist: null,
  });
});

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
