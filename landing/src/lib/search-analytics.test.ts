import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalizeSearchFilters,
  findRecentSearchIngest,
  normalizeSearchQuery,
  rememberSearchIngest,
  resetSearchAnalyticsStateForTests,
  resolveSearchIdForCommit,
  searchDedupSignature,
  searchFiltersKey,
  sanitizeSearchPagePath,
} from "./search-analytics";

test("normalizeSearchQuery trims, collapses spaces, lowercases norm", () => {
  const parsed = normalizeSearchQuery("  Кошка   в космосе \n");
  assert.deepEqual(parsed, {
    raw: "Кошка в космосе",
    norm: "кошка в космосе",
  });
  assert.equal(normalizeSearchQuery("к"), null);
  assert.equal(normalizeSearchQuery("x".repeat(161)), null);
});

test("canonicalizeSearchFilters drops empty keys and caps length", () => {
  assert.deepEqual(
    canonicalizeSearchFilters({
      audience: " devushka ",
      style: null,
      occasion: "",
      object: "a".repeat(90),
    }),
    { audience: "devushka", object: "a".repeat(80) },
  );
  assert.equal(
    searchFiltersKey({ audience: "devushka", style: null, occasion: null, object: null }),
    '{"audience":"devushka"}',
  );
});

test("resolveSearchIdForCommit reuses requestKey and skips a second ingest", () => {
  resetSearchAnalyticsStateForTests();
  const first = resolveSearchIdForCommit({
    requestKey: "кошка\n\n\n\n",
    sessionId: "11111111-1111-4111-8111-111111111111",
    queryNorm: "кошка",
    filtersKey: "{}",
    mint: () => "22222222-2222-4222-8222-222222222222",
  });
  const second = resolveSearchIdForCommit({
    requestKey: "кошка\n\n\n\n",
    sessionId: "11111111-1111-4111-8111-111111111111",
    queryNorm: "кошка",
    filtersKey: "{}",
    mint: () => "33333333-3333-4333-8333-333333333333",
  });
  assert.equal(first.shouldIngest, true);
  assert.equal(second.shouldIngest, false);
  assert.equal(first.searchId, second.searchId);
  assert.equal(first.searchId, "22222222-2222-4222-8222-222222222222");
});

test("resolveSearchIdForCommit prefers snapshot id", () => {
  resetSearchAnalyticsStateForTests();
  const resolved = resolveSearchIdForCommit({
    requestKey: "аниме\n\n\n\n",
    sessionId: null,
    queryNorm: "аниме",
    filtersKey: "{}",
    existing: "44444444-4444-4444-8444-444444444444",
    mint: () => "55555555-5555-4555-8555-555555555555",
  });
  assert.equal(resolved.searchId, "44444444-4444-4444-8444-444444444444");
  assert.equal(resolved.shouldIngest, true);
});

test("30s signature dedup reuses the first search id", () => {
  resetSearchAnalyticsStateForTests();
  const now = 1_000_000;
  const sessionId = "11111111-1111-4111-8111-111111111111";
  const signature = searchDedupSignature(sessionId, "кошка", "{}");
  rememberSearchIngest(signature, "66666666-6666-4666-8666-666666666666", now);
  assert.equal(findRecentSearchIngest(signature, now + 29_000), "66666666-6666-4666-8666-666666666666");

  const resolved = resolveSearchIdForCommit({
    requestKey: "кошка фильтр\n\n\n\n",
    sessionId,
    queryNorm: "кошка",
    filtersKey: "{}",
    now,
    mint: () => "77777777-7777-4777-8777-777777777777",
  });
  assert.equal(resolved.searchId, "66666666-6666-4666-8666-666666666666");
  assert.equal(resolved.shouldIngest, false);
  resetSearchAnalyticsStateForTests();
  rememberSearchIngest(signature, "66666666-6666-4666-8666-666666666666", now);
  assert.equal(findRecentSearchIngest(signature, now + 31_000), null);
});

test("sanitizeSearchPagePath requires a site path", () => {
  assert.equal(sanitizeSearchPagePath("/search?q=кошка"), "/search?q=кошка");
  assert.equal(sanitizeSearchPagePath("https://promptshot.ru/search"), null);
  assert.equal(sanitizeSearchPagePath(""), null);
});
