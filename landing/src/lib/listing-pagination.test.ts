import assert from "node:assert/strict";
import test from "node:test";
import {
  hasListingSentinelReachedLoadRange,
  hasMoreRankedPages,
  hasMoreSearchPages,
  LISTING_SEARCH_API_MAX_LIMIT,
  LISTING_SEARCH_PAGE_SIZE,
  LISTING_SEARCH_RPC_MAX_LIMIT,
  takeSearchPage,
  isListingSentinelInLoadRange,
  LISTING_FILL_LOOKAHEAD_PX,
  LISTING_INFINITE_PAGE_SIZE,
  LISTING_SSR_INITIAL_LIMIT,
  listingContentRemainingPx,
  resolveListingPageStep,
  shouldDrainListingPage,
  shouldFillListingPage,
} from "./listing-pagination";

test("hasMoreRankedPages uses ranked offset, not expanded card count", () => {
  assert.equal(hasMoreRankedPages(0, 10, 80), true);
  assert.equal(hasMoreRankedPages(10, 24, 80), true);
  assert.equal(hasMoreRankedPages(58, 24, 80), false);
  assert.equal(hasMoreRankedPages(10, 0, 80), false);
  assert.equal(hasMoreRankedPages(0, 10, 0), false);
});

test("hasMoreSearchPages treats a full page as a signal to fetch again", () => {
  assert.equal(hasMoreSearchPages(10, 10), true);
  assert.equal(hasMoreSearchPages(24, 24), true);
  assert.equal(hasMoreSearchPages(7, 10), false);
  assert.equal(hasMoreSearchPages(0, 10), false);
  assert.equal(hasMoreSearchPages(10, 0), false);
});

test("takeSearchPage uses the extra row as hasMore, not as a visible card", () => {
  assert.equal(LISTING_SEARCH_PAGE_SIZE, 48);
  assert.equal(LISTING_SEARCH_RPC_MAX_LIMIT, 100);
  assert.equal(LISTING_SEARCH_API_MAX_LIMIT, 99);
  assert.ok(LISTING_SEARCH_PAGE_SIZE + 1 <= LISTING_SEARCH_RPC_MAX_LIMIT);
  const rows = Array.from({ length: 49 }, (_, index) => index);
  const page = takeSearchPage(rows, 48);
  assert.equal(page.cards.length, 48);
  assert.equal(page.hasMore, true);
  assert.deepEqual(takeSearchPage(rows.slice(0, 20), 48), {
    cards: rows.slice(0, 20),
    hasMore: false,
  });
});

test("listing starts with 10 ranked rows and then advances by 24", () => {
  assert.equal(LISTING_SSR_INITIAL_LIMIT, 10);
  assert.equal(LISTING_INFINITE_PAGE_SIZE, 24);
  assert.deepEqual(
    Array.from({ length: 4 }, (_, index) =>
      LISTING_SSR_INITIAL_LIMIT + LISTING_INFINITE_PAGE_SIZE * index
    ),
    [10, 34, 58, 82]
  );
});

test("resolveListingPageStep falls back when ranked_batch_size is missing", () => {
  assert.equal(resolveListingPageStep(24), 24);
  assert.equal(resolveListingPageStep(0), 24);
  assert.equal(resolveListingPageStep(12, 24), 12);
});

test("shouldDrainListingPage continues only when the sentinel is still in range", () => {
  assert.equal(
    shouldDrainListingPage({
      hasMore: true,
      loading: false,
      restoreInProgress: false,
      sentinelInRange: true,
    }),
    true
  );
  assert.equal(
    shouldDrainListingPage({
      hasMore: true,
      loading: false,
      restoreInProgress: false,
      sentinelInRange: false,
    }),
    false
  );
  assert.equal(
    shouldDrainListingPage({
      hasMore: true,
      loading: true,
      restoreInProgress: false,
      sentinelInRange: true,
    }),
    false
  );
  assert.equal(
    shouldDrainListingPage({
      hasMore: true,
      loading: false,
      restoreInProgress: true,
      sentinelInRange: true,
    }),
    false
  );
});

test("isListingSentinelInLoadRange includes the 600px lookahead", () => {
  const sentinel = {
    getBoundingClientRect: () => ({ top: 1400, bottom: 1401 }),
  };
  assert.equal(
    isListingSentinelInLoadRange(sentinel, { top: 0, bottom: 800 }, 600),
    true
  );
  assert.equal(
    isListingSentinelInLoadRange(sentinel, { top: 0, bottom: 800 }, 500),
    false
  );
});

test("fill uses last card bottom, not a tall empty masonry box", () => {
  assert.equal(listingContentRemainingPx(400, 844), -444);
  assert.equal(
    shouldFillListingPage({
      hasMore: true,
      loading: false,
      restoreInProgress: false,
      remainingPx: listingContentRemainingPx(400, 844),
      pagesLoadedThisPass: 0,
    }),
    true
  );
  assert.equal(
    shouldFillListingPage({
      hasMore: true,
      loading: false,
      restoreInProgress: false,
      remainingPx: listingContentRemainingPx(3000, 844),
      pagesLoadedThisPass: 0,
    }),
    false
  );
  assert.equal(
    shouldFillListingPage({
      hasMore: true,
      loading: false,
      restoreInProgress: false,
      remainingPx: listingContentRemainingPx(400, 844),
      pagesLoadedThisPass: 3,
    }),
    false
  );
  assert.ok(LISTING_FILL_LOOKAHEAD_PX >= 800);
});

test("fast-scroll fallback treats an already skipped sentinel as reached", () => {
  const skippedSentinel = {
    getBoundingClientRect: () => ({ top: -2400, bottom: -2399 }),
  };
  assert.equal(
    isListingSentinelInLoadRange(
      skippedSentinel,
      { top: 0, bottom: 800 },
      600
    ),
    false
  );
  assert.equal(
    hasListingSentinelReachedLoadRange(
      skippedSentinel,
      { bottom: 800 },
      600
    ),
    true
  );
});
