import assert from "node:assert/strict";
import test from "node:test";
import {
  attributionSnapshotPatch,
  resolvePaymentTrafficSource,
} from "./payment-attribution";

test("checkout attribution wins with user fallback", () => {
  assert.deepEqual(
    resolvePaymentTrafficSource(
      { utm_source: "yandex", utm_campaign: "new", utm_landing_path: "/new?x=1" },
      { utm_source: "old", utm_medium: "cpc", utm_campaign: "old" },
    ),
    {
      utm_source: "yandex",
      utm_medium: "cpc",
      utm_campaign: "new",
      utm_content: null,
      utm_term: null,
      utm_landing_path: "/new",
    },
  );
});

test("idempotent patch fills nulls without overwrite", () => {
  assert.deepEqual(
    attributionSnapshotPatch(
      { utm_source: "first", utm_medium: null },
      {
        utm_source: "second",
        utm_medium: "cpc",
        utm_campaign: null,
        utm_content: null,
        utm_term: null,
        utm_landing_path: null,
      },
    ),
    { utm_medium: "cpc" },
  );
});
