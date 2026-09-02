import assert from "node:assert/strict";
import test from "node:test";
import {
  PUBLIC_OBJECT_CACHE_CONTROL_SECONDS,
  publicObjectUploadOptions,
} from "./storage-cache-control";

test("public storage objects cache for at least 30 days", () => {
  const seconds = Number(PUBLIC_OBJECT_CACHE_CONTROL_SECONDS);
  assert.ok(seconds >= 60 * 60 * 24 * 30);
  assert.equal(
    publicObjectUploadOptions({ contentType: "video/mp4", upsert: true }).cacheControl,
    PUBLIC_OBJECT_CACHE_CONTROL_SECONDS
  );
});
