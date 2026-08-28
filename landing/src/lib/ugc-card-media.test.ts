import assert from "node:assert/strict";
import test from "node:test";
import { buildUgcCardMediaInserts, planUgcCardMediaSync } from "./ugc-card-media";

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
    rows.map((row) => [row.media_index, row.storage_path, row.is_primary]),
    [
      [0, tiles[0], true],
      [1, tiles[1], false],
      [2, tiles[2], false],
      [3, tiles[3], false],
    ],
  );
});
