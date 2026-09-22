import assert from "node:assert/strict";
import test from "node:test";
import {
  NEXT_CACHE_MAX_MEMORY_BYTES,
  NEXT_IMAGE_DEVICE_SIZES,
  NEXT_IMAGE_DISK_CACHE_MAX_BYTES,
} from "./next-cache-memory";

test("Next in-memory cache stays well below the 2 GiB container", () => {
  assert.equal(NEXT_CACHE_MAX_MEMORY_BYTES, 32 * 1024 * 1024);
  assert.ok(NEXT_CACHE_MAX_MEMORY_BYTES <= 50 * 1024 * 1024);
});

test("Next image variants stay at or below 1920px and the disk cache is capped", () => {
  assert.equal(NEXT_IMAGE_DISK_CACHE_MAX_BYTES, 256 * 1024 * 1024);
  assert.deepEqual([...NEXT_IMAGE_DEVICE_SIZES], [640, 750, 828, 1080, 1200, 1920]);
  assert.ok(Math.max(...NEXT_IMAGE_DEVICE_SIZES) <= 1920);
});
