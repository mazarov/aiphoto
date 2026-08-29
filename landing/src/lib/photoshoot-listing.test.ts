import assert from "node:assert/strict";
import test from "node:test";
import {
  filterPhotoshootListingCards,
  isPhotoshootListingCard,
} from "./photoshoot-listing";

test("isPhotoshootListingCard keeps a four-tile photoshoot album", () => {
  assert.equal(
    isPhotoshootListingCard({
      datasetSlug: "web_generation_ugc",
      photoUrls: ["1", "2", "3", "4"],
      photoMeta: [
        { path: "user/job/lease-1.jpg" },
        { path: "user/job/lease-2.jpg" },
        { path: "user/job/lease-3.jpg" },
        { path: "user/job/lease-4.jpg" },
      ],
    }),
    true
  );
});

test("isPhotoshootListingCard drops a single-frame catalog card", () => {
  assert.equal(
    isPhotoshootListingCard({
      datasetSlug: "telegram_export",
      photoUrls: ["1"],
      photoMeta: [{ path: "channel/photo.jpg" }],
    }),
    false
  );
});

test("filterPhotoshootListingCards keeps only photoshoot albums", () => {
  const photoshoot = {
    id: "shoot",
    datasetSlug: "web_generation_ugc",
    photoUrls: ["1", "2", "3", "4"],
    photoMeta: [
      { path: "user/job/lease-1.jpg" },
      { path: "user/job/lease-2.jpg" },
      { path: "user/job/lease-3.jpg" },
      { path: "user/job/lease-4.jpg" },
    ],
  };
  const single = {
    id: "single",
    datasetSlug: "telegram_export",
    photoUrls: ["1"],
    photoMeta: [{ path: "channel/photo.jpg" }],
  };
  assert.deepEqual(filterPhotoshootListingCards([single, photoshoot]), [photoshoot]);
});
