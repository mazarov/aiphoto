import assert from "node:assert/strict";
import test from "node:test";
import {
  bucketFeatureSubject,
  createFeatureVisitorId,
  isBucketEnabled,
  isValidFeatureVisitorId,
  PROMPT_CARD_GENERATION_FEATURE,
} from "./feature-rollout-core";

test("visitor IDs are valid UUIDs", () => {
  const visitorId = createFeatureVisitorId();
  assert.equal(isValidFeatureVisitorId(visitorId), true);
  assert.equal(isValidFeatureVisitorId("not-a-uuid"), false);
});

test("bucket assignment is stable and in basis-point range", () => {
  const subjectId = "e5cae12f-343e-4cc8-a7e7-0e28bfe10b38";
  const first = bucketFeatureSubject(
    PROMPT_CARD_GENERATION_FEATURE,
    subjectId
  );
  const second = bucketFeatureSubject(
    PROMPT_CARD_GENERATION_FEATURE,
    subjectId
  );

  assert.equal(first, second);
  assert.ok(first >= 0);
  assert.ok(first < 10_000);
});

test("rollout boundaries are fail-closed and monotonic", () => {
  const bucket = 499;

  assert.equal(isBucketEnabled(bucket, -1), false);
  assert.equal(isBucketEnabled(bucket, 0), false);
  assert.equal(isBucketEnabled(bucket, 499), false);
  assert.equal(isBucketEnabled(bucket, 500), true);
  assert.equal(isBucketEnabled(bucket, 1_000), true);
  assert.equal(isBucketEnabled(bucket, 10_001), true);
});
