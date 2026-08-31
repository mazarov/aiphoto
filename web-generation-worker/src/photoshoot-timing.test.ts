import assert from "node:assert/strict";
import test from "node:test";
import {
  elapsedMs,
  parseTimestampMs,
  queueWaitMs,
  snapshotPhotoshootTiming,
} from "./photoshoot-timing";

test("elapsedMs never goes negative", () => {
  assert.equal(elapsedMs(1_000, 1_250), 250);
  assert.equal(elapsedMs(1_250, 1_000), 0);
});

test("parseTimestampMs accepts ISO and epoch", () => {
  assert.equal(parseTimestampMs("2026-08-31T12:00:00.000Z"), Date.parse("2026-08-31T12:00:00.000Z"));
  assert.equal(parseTimestampMs(1_725_000_000_000), 1_725_000_000_000);
  assert.equal(parseTimestampMs(""), null);
  assert.equal(parseTimestampMs("not-a-date"), null);
  assert.equal(parseTimestampMs(undefined), null);
});

test("queueWaitMs is created_at → claim", () => {
  const created = "2026-08-31T12:00:00.000Z";
  const claimed = Date.parse(created) + 8_400;
  assert.equal(queueWaitMs(created, claimed), 8_400);
  assert.equal(queueWaitMs(null, claimed), null);
});

test("snapshotPhotoshootTiming sums enqueue → done and worker wall", () => {
  const created = "2026-08-31T12:00:00.000Z";
  const startedAt = Date.parse(created) + 12_000;
  const now = startedAt + 61_000;
  const snap = snapshotPhotoshootTiming(
    {
      createdAt: created,
      startedAt,
      inputDownloadMs: 400,
      plannerMs: 7_200,
      planPersistMs: 80,
      provider: "gemini-3-pro-image-preview",
      providerMs: 48_000,
      encodeMs: 180,
      sheetUploadMs: 220,
      splitMs: 90,
      tileUploadMs: 310,
    },
    now,
  );
  assert.equal(snap.queueWaitMs, 12_000);
  assert.equal(snap.workerMs, 61_000);
  assert.equal(snap.enqueueToDoneMs, 73_000);
  assert.equal(snap.provider, "gemini-3-pro-image-preview");
  assert.equal(snap.providerMs, 48_000);
  assert.equal(snap.plannerMs, 7_200);
});
