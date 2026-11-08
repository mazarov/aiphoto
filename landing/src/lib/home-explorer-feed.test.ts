import assert from "node:assert/strict";
import test from "node:test";
import {
  HOME_ALL_FEED,
  homeFeedQuery,
  homeFeedUrl,
  readHomeFeedPage,
} from "./home-explorer-feed";

test("feed follows search, then chip, then «Все»", () => {
  const chip = { dimension: "occasion_tag", slug: "23-fevralya" };
  assert.deepEqual(homeFeedQuery("  кот ", chip), { q: "кот" });
  assert.deepEqual(homeFeedQuery("к", chip), {
    occasion_tag: "23-fevralya",
    sort: "popular",
    strict: "1",
  });
  assert.equal(homeFeedQuery("", null), HOME_ALL_FEED);
  assert.equal(
    homeFeedUrl(HOME_ALL_FEED, 16, 24),
    "/api/listing?sort=popular&limit=24&offset=16",
  );
});

test("listing pages advance by ranked rows, not enriched cards", () => {
  assert.deepEqual(
    readHomeFeedPage({
      feed: HOME_ALL_FEED,
      offset: 16,
      limit: 24,
      receivedCards: 30,
      rankedBatchSize: 24,
      totalCount: 100,
      hasMore: undefined,
    }),
    { nextOffset: 40, hasMore: true },
  );
  assert.deepEqual(
    readHomeFeedPage({
      feed: HOME_ALL_FEED,
      offset: 88,
      limit: 24,
      receivedCards: 12,
      rankedBatchSize: 12,
      totalCount: 100,
      hasMore: undefined,
    }),
    { nextOffset: 100, hasMore: false },
  );
});

test("search trusts has_more and an empty page ends the feed", () => {
  assert.deepEqual(
    readHomeFeedPage({
      feed: { q: "кот" },
      offset: 0,
      limit: 16,
      receivedCards: 16,
      rankedBatchSize: 16,
      totalCount: 17,
      hasMore: true,
    }),
    { nextOffset: 16, hasMore: true },
  );
  assert.deepEqual(
    readHomeFeedPage({
      feed: HOME_ALL_FEED,
      offset: 40,
      limit: 24,
      receivedCards: 0,
      rankedBatchSize: 0,
      totalCount: 100,
      hasMore: undefined,
    }),
    { nextOffset: 40, hasMore: false },
  );
});
