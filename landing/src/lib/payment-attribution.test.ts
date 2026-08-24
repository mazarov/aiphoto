import assert from "node:assert/strict";
import test from "node:test";
import {
  attributionSnapshotPatch,
  resolvePaymentTrafficSource,
} from "./payment-attribution";

test("same-tier checkout fills holes from the user bag", () => {
  assert.deepEqual(
    resolvePaymentTrafficSource(
      { utm_source: "yandex", utm_medium: "cpc", utm_campaign: "new", utm_landing_path: "/new?x=1" },
      { utm_source: "yandex", utm_medium: "cpc", utm_campaign: "old", utm_content: "ad" },
    ),
    {
      utm_source: "yandex",
      utm_medium: "cpc",
      utm_campaign: "new",
      utm_content: "ad",
      utm_term: null,
      utm_landing_path: "/new",
    },
  );
});

test("paid checkout replaces user SEO as a whole bag", () => {
  assert.deepEqual(
    resolvePaymentTrafficSource(
      {
        utm_source: "yandex",
        utm_medium: "cpc",
        utm_campaign: "123",
        utm_landing_path: "/generaciya-foto",
      },
      {
        utm_source: "yandex_seo",
        utm_medium: "organic",
        utm_landing_path: "/sobytiya/den-rozhdeniya",
      },
    ),
    {
      utm_source: "yandex",
      utm_medium: "cpc",
      utm_campaign: "123",
      utm_content: null,
      utm_term: null,
      utm_landing_path: "/generaciya-foto",
    },
  );
});

test("paid user wins over unpaid checkout", () => {
  assert.deepEqual(
    resolvePaymentTrafficSource(
      { utm_source: "yandex_seo", utm_medium: "organic", utm_landing_path: "/" },
      { utm_source: "yandex", utm_medium: "cpc", utm_campaign: "old" },
    ),
    {
      utm_source: "yandex",
      utm_medium: "cpc",
      utm_campaign: "old",
      utm_content: null,
      utm_term: null,
      utm_landing_path: null,
    },
  );
});

test("idempotent patch fills nulls without overwrite", () => {
  assert.deepEqual(
    attributionSnapshotPatch(
      { utm_source: "yandex", utm_medium: "cpc", utm_campaign: null },
      {
        utm_source: "yandex",
        utm_medium: "cpc",
        utm_campaign: "123",
        utm_content: null,
        utm_term: null,
        utm_landing_path: null,
      },
    ),
    { utm_campaign: "123" },
  );
});

test("idempotent patch upgrades SEO snapshot to paid", () => {
  const patch = attributionSnapshotPatch(
    {
      utm_source: "yandex_seo",
      utm_medium: "organic",
      utm_landing_path: "/sobytiya/den-rozhdeniya",
    },
    {
      utm_source: "yandex",
      utm_medium: "cpc",
      utm_campaign: "123",
      utm_content: null,
      utm_term: null,
      utm_landing_path: "/generaciya-foto",
    },
  );
  assert.equal(patch.utm_source, "yandex");
  assert.equal(patch.utm_medium, "cpc");
  assert.equal(patch.utm_landing_path, "/generaciya-foto");
});
