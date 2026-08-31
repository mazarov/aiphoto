import assert from "node:assert/strict";
import test from "node:test";
import { PHOTO_PROMPT_EPHEMERAL_ID } from "./generate-photo-prompt";
import {
  libraryPhotosForCache,
  parseCachedUserGenerationPhotos,
} from "./user-generation-photos-cache";

const sample = {
  id: "photo-1",
  storagePath: "u/a.jpg",
  previewUrl: "https://example.test/a.jpg",
  originalFilename: "a.jpg",
  width: 800,
  height: 1000,
  createdAt: "2026-08-31T00:00:00.000Z",
};

test("library cache drops ephemeral photo-prompt rows", () => {
  assert.deepEqual(
    libraryPhotosForCache([
      { id: PHOTO_PROMPT_EPHEMERAL_ID },
      { id: "photo-1" },
    ]),
    [{ id: "photo-1" }],
  );
});

test("library cache reads only the signed-in user's payload", () => {
  assert.deepEqual(
    parseCachedUserGenerationPhotos({ userId: "u1", photos: [sample] }, "u1"),
    [sample],
  );
  assert.equal(
    parseCachedUserGenerationPhotos({ userId: "u1", photos: [sample] }, "u2"),
    null,
  );
  assert.equal(parseCachedUserGenerationPhotos({ userId: "u1" }, "u1"), null);
  assert.deepEqual(
    parseCachedUserGenerationPhotos(
      { userId: "u1", photos: [{ id: "" }, sample, { foo: 1 }] },
      "u1",
    ),
    [sample],
  );
});
