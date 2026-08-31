import assert from "node:assert/strict";
import test from "node:test";
import {
  buildUgcCardMediaInserts,
  buildVideoUgcMediaItems,
  firstInputPhotoPath,
  planUgcCardMediaSync,
  videoUgcPosterStoragePath,
} from "./ugc-card-media";

const tiles = [
  "user/job/lease-1.jpg",
  "user/job/lease-2.jpg",
  "user/job/lease-3.jpg",
  "user/job/lease-4.jpg",
];

test("photoshoot draft with tile 1 appends the other three", () => {
  assert.deepEqual(
    planUgcCardMediaSync([{ media_index: 0, storage_path: tiles[0] }], tiles),
    { action: "append", paths: tiles.slice(1), startIndex: 1 },
  );
});

test("complete photoset is a no-op", () => {
  assert.deepEqual(
    planUgcCardMediaSync(
      tiles.map((storage_path, media_index) => ({ media_index, storage_path })),
      tiles,
    ),
    { action: "noop" },
  );
});

test("sheet as primary is replaced by the four tiles", () => {
  assert.deepEqual(
    planUgcCardMediaSync(
      [{ media_index: 0, storage_path: "user/job/lease.jpg" }],
      tiles,
    ),
    { action: "replace", paths: tiles },
  );
});

test("media inserts mark only the first frame primary", () => {
  const rows = buildUgcCardMediaInserts({
    cardId: "card",
    bucket: "results",
    paths: tiles,
  });
  assert.equal(rows.length, 4);
  assert.deepEqual(
    rows.map((row) => [row.media_index, row.storage_path, row.is_primary, row.media_type]),
    [
      [0, tiles[0], true, "photo"],
      [1, tiles[1], false, "photo"],
      [2, tiles[2], false, "photo"],
      [3, tiles[3], false, "photo"],
    ],
  );
});

test("video poster path is unique per clip, not the parent photo", () => {
  assert.equal(
    videoUgcPosterStoragePath("user/job/clip.mp4"),
    "user/job/ugc-poster.jpg",
  );
  assert.equal(videoUgcPosterStoragePath("clip.mp4"), "clip.mp4/ugc-poster.jpg");
});

test("video UGC is poster photo plus mp4", () => {
  const items = buildVideoUgcMediaItems({
    posterPath: "user/parent.jpg",
    videoPath: "user/clip.mp4",
  });
  assert.deepEqual(items, [
    { path: "user/parent.jpg", mediaType: "photo" },
    { path: "user/clip.mp4", mediaType: "video" },
  ]);
  const rows = buildUgcCardMediaInserts({
    cardId: "card",
    bucket: "results",
    items,
  });
  assert.deepEqual(
    rows.map((row) => [row.media_type, row.storage_path, row.is_primary]),
    [
      ["photo", "user/parent.jpg", true],
      ["video", "user/clip.mp4", false],
    ],
  );
  assert.equal(buildVideoUgcMediaItems({ posterPath: "", videoPath: "x.mp4" }).length, 0);
  assert.equal(firstInputPhotoPath(["", "a.jpg"]), "a.jpg");
});
