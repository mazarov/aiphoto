import assert from "node:assert/strict";
import test from "node:test";
import {
  filterPhotoshootListingCards,
  filterPhotoshootListingCardsBySeoTag,
  isPhotoshootListingCard,
  photoshootTagOversampleLimit,
  takePublishedPhotoshootAlbums,
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

test("scenario filter requires both photoshoot media and matching SEO tag", () => {
  const base = {
    datasetSlug: "web_generation_ugc",
    photoUrls: ["1", "2", "3", "4"],
    photoMeta: [
      { path: "user/job/lease-1.jpg" },
      { path: "user/job/lease-2.jpg" },
      { path: "user/job/lease-3.jpg" },
      { path: "user/job/lease-4.jpg" },
    ],
  };
  const women = {
    ...base,
    id: "women",
    seo_tags: { audience_tag: ["devushka"] },
  };
  const men = {
    ...base,
    id: "men",
    seo_tags: { audience_tag: ["muzhchina"] },
  };
  const single = {
    id: "single",
    datasetSlug: "telegram_export",
    photoUrls: ["1"],
    photoMeta: [{ path: "channel/photo.jpg" }],
    seo_tags: { audience_tag: ["devushka"] },
  };

  assert.deepEqual(
    filterPhotoshootListingCardsBySeoTag(
      [single, men, women],
      "audience_tag",
      "devushka"
    ),
    [women]
  );
});

test("photoshoot tag query oversample is three times the limit and capped at 40", () => {
  assert.equal(photoshootTagOversampleLimit(6), 18);
  assert.equal(photoshootTagOversampleLimit(8), 24);
  assert.equal(photoshootTagOversampleLimit(16), 40);
  assert.equal(photoshootTagOversampleLimit(0), 0);
});

test("a tagged album outside the recent hub tail is kept and a single frame is dropped", () => {
  const album = {
    id: "winter",
    datasetSlug: "web_generation_ugc",
    photoUrls: ["1", "2", "3", "4"],
    photoMeta: [
      { path: "user/job/lease-1.jpg" },
      { path: "user/job/lease-2.jpg" },
      { path: "user/job/lease-3.jpg" },
      { path: "user/job/lease-4.jpg" },
    ],
    seo_tags: { object_tag: ["zima"] },
  };
  const single = {
    id: "single",
    datasetSlug: "web_generation_ugc",
    photoUrls: ["only"],
    photoMeta: [{ path: "channel/photo.jpg" }],
    seo_tags: { object_tag: ["zima"] },
  };
  const recentTail = [
    {
      id: "recent-woman",
      datasetSlug: "web_generation_ugc",
      photoUrls: ["1", "2", "3", "4"],
      photoMeta: [
        { path: "user/job/other-1.jpg" },
        { path: "user/job/other-2.jpg" },
        { path: "user/job/other-3.jpg" },
        { path: "user/job/other-4.jpg" },
      ],
      seo_tags: { audience_tag: ["devushka"] },
    },
  ];

  assert.deepEqual(
    filterPhotoshootListingCardsBySeoTag(recentTail, "object_tag", "zima"),
    []
  );
  assert.deepEqual(
    takePublishedPhotoshootAlbums([single, album], 6).map((card) => card.id),
    ["winter"]
  );
});
