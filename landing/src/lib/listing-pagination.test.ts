import assert from "node:assert/strict";
import test from "node:test";
import {
  hasMoreRankedPages,
  isListingSentinelInLoadRange,
  resolveListingPageStep,
  shouldDrainListingPage,
} from "./listing-pagination";

test("hasMoreRankedPages uses ranked offset, not expanded card count", () => {
  assert.equal(hasMoreRankedPages(0, 10, 80), true);
  assert.equal(hasMoreRankedPages(10, 48, 80), true);
  assert.equal(hasMoreRankedPages(58, 48, 80), false);
  assert.equal(hasMoreRankedPages(10, 0, 80), false);
  assert.equal(hasMoreRankedPages(0, 10, 0), false);
});

test("resolveListingPageStep falls back when ranked_batch_size is missing", () => {
  assert.equal(resolveListingPageStep(48), 48);
  assert.equal(resolveListingPageStep(0), 48);
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
