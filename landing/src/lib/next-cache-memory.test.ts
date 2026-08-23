import assert from "node:assert/strict";
import test from "node:test";
import { NEXT_CACHE_MAX_MEMORY_BYTES } from "./next-cache-memory";

test("Next in-memory cache stays well below the 2 GiB container", () => {
  assert.equal(NEXT_CACHE_MAX_MEMORY_BYTES, 32 * 1024 * 1024);
  assert.ok(NEXT_CACHE_MAX_MEMORY_BYTES <= 50 * 1024 * 1024);
});
