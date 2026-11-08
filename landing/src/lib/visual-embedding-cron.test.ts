import assert from "node:assert/strict";
import test from "node:test";
import { shouldDrainVisualEmbeddings } from "./visual-embedding-cron";

test("visual embedding drain runs on every 5th UTC minute", () => {
  assert.equal(shouldDrainVisualEmbeddings(new Date("2026-11-08T16:40:01Z")), true);
  assert.equal(shouldDrainVisualEmbeddings(new Date("2026-11-08T16:45:01Z")), true);
  assert.equal(shouldDrainVisualEmbeddings(new Date("2026-11-08T17:00:01Z")), true);
  assert.equal(shouldDrainVisualEmbeddings(new Date("2026-11-08T16:41:01Z")), false);
  assert.equal(shouldDrainVisualEmbeddings(new Date("2026-11-08T16:44:01Z")), false);
});
