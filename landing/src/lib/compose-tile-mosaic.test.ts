import assert from "node:assert/strict";
import test from "node:test";
import {
  composePhotosPreviewUrls,
  composePreviewImageUrls,
  composeTileMosaicGrid,
} from "./compose-tile-mosaic";

test("compose preview urls drop empty slots", () => {
  assert.deepEqual(composePreviewImageUrls(["a", " ", null, undefined, "b"]), [
    "a",
    "b",
  ]);
  assert.deepEqual(
    composePhotosPreviewUrls([
      { previewUrl: "a" },
      { previewUrl: " " },
      { previewUrl: null },
      { previewUrl: "b" },
    ]),
    ["a", "b"],
  );
});

test("mosaic splits the square into N cells", () => {
  assert.deepEqual(composeTileMosaicGrid(0), { columns: 1, rows: 1 });
  assert.deepEqual(composeTileMosaicGrid(1), { columns: 1, rows: 1 });
  assert.deepEqual(composeTileMosaicGrid(2), { columns: 2, rows: 1 });
  assert.deepEqual(composeTileMosaicGrid(3), { columns: 3, rows: 1 });
  assert.deepEqual(composeTileMosaicGrid(4), { columns: 2, rows: 2 });
  assert.deepEqual(composeTileMosaicGrid(5), { columns: 3, rows: 2 });
  assert.deepEqual(composeTileMosaicGrid(6), { columns: 3, rows: 2 });
  assert.deepEqual(composeTileMosaicGrid(9), { columns: 3, rows: 3 });
  assert.deepEqual(composeTileMosaicGrid(10), { columns: 4, rows: 3 });
});
