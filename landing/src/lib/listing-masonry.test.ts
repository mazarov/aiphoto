import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStableMasonryLayout,
  FALLBACK_LISTING_ASPECT_RATIOS,
  listingPhotoAspectRatio,
} from "./listing-masonry";

test("listingPhotoAspectRatio uses the first photo's real ratio", () => {
  assert.equal(listingPhotoAspectRatio(1200, 800, 0), 1.5);
  assert.equal(listingPhotoAspectRatio(800, 1200, 3), 800 / 1200);
});

test("listingPhotoAspectRatio falls back to the rotating portrait set", () => {
  assert.equal(listingPhotoAspectRatio(null, null, 0), FALLBACK_LISTING_ASPECT_RATIOS[0]);
  assert.equal(listingPhotoAspectRatio(0, 100, 1), FALLBACK_LISTING_ASPECT_RATIOS[1]);
  assert.equal(listingPhotoAspectRatio(100, 0, 7), FALLBACK_LISTING_ASPECT_RATIOS[2]);
});

test("stable masonry keeps prefix placement after append", () => {
  const first = buildStableMasonryLayout(
    [0.75, 0.8, 1, 0.66, 1.2],
    4,
    12,
    1228
  );
  const appended = buildStableMasonryLayout(
    [0.75, 0.8, 1, 0.66, 1.2, 0.75, 1, 0.8],
    4,
    12,
    1228
  );
  assert.deepEqual(
    appended.placements.slice(0, first.placements.length),
    first.placements
  );
});

test("stable masonry places new cards inside existing lanes", () => {
  const layout = buildStableMasonryLayout(
    [0.75, 0.8, 1, 0.66, 1.2],
    4,
    12,
    1228
  );
  assert.equal(layout.placements.length, 5);
  assert.notEqual(layout.placements[4]?.top, "calc(0cqw)");
  assert.match(layout.height, /^max\(/);
});
