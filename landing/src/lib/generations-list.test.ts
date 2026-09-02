import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGenerationResultMedia,
  generationGridDisplay,
  isUnknownGenerationsListRpc,
  mergeGenerationFirstPage,
  takeGenerationPage,
} from "./generations-list";

test("takeGenerationPage uses the extra row as hasMore", () => {
  const rows = [1, 2, 3, 4];
  assert.deepEqual(takeGenerationPage(rows, 3), { page: [1, 2, 3], hasMore: true });
  assert.deepEqual(takeGenerationPage(rows.slice(0, 3), 3), {
    page: [1, 2, 3],
    hasMore: false,
  });
  assert.deepEqual(takeGenerationPage([], 24), { page: [], hasMore: false });
});

test("mergeGenerationFirstPage prepends new rows and keeps older pages", () => {
  const previous = [
    { id: "b", n: 1 },
    { id: "c", n: 2 },
    { id: "d", n: 3 },
  ];
  const fresh = [
    { id: "a", n: 0 },
    { id: "b", n: 11 },
  ];
  assert.deepEqual(mergeGenerationFirstPage(previous, fresh), [
    { id: "a", n: 0 },
    { id: "b", n: 11 },
    { id: "c", n: 2 },
    { id: "d", n: 3 },
  ]);
});

test("isUnknownGenerationsListRpc matches missing PostgREST function", () => {
  assert.equal(isUnknownGenerationsListRpc({ code: "PGRST202" }), true);
  assert.equal(isUnknownGenerationsListRpc({ code: "42883" }), true);
  assert.equal(
    isUnknownGenerationsListRpc({
      message: "Could not find the function public.landing_list_my_generations",
    }),
    true,
  );
  assert.equal(isUnknownGenerationsListRpc({ message: "permission denied" }), false);
});

test("buildGenerationResultMedia keeps full URLs and listing thumbs", () => {
  const media = buildGenerationResultMedia({
    bucket: "web-generation-results",
    editKind: null,
    sheetPath: "u/job.jpg",
    tilePaths: null,
    toPublicUrl: (bucket, path) => `full/${bucket}/${path}`,
    toListingUrl: (bucket, path) => `thumb/${bucket}/${path}`,
  });
  assert.equal(media.resultUrl, "full/web-generation-results/u/job.jpg");
  assert.equal(media.resultThumbUrl, "thumb/web-generation-results/u/job.jpg");
  assert.equal(media.photoshootTileUrls, null);
});

test("buildGenerationResultMedia does not transform video into an image thumb", () => {
  const media = buildGenerationResultMedia({
    bucket: "web-generation-results",
    editKind: null,
    sheetPath: "u/job.mp4",
    tilePaths: null,
    modality: "video",
    resultMimeType: "video/mp4",
    toPublicUrl: (bucket, path) => `full/${bucket}/${path}`,
    toListingUrl: (bucket, path) => `thumb/${bucket}/${path}`,
  });
  assert.equal(media.resultUrl, "full/web-generation-results/u/job.mp4");
  assert.equal(media.resultThumbUrl, null);
});

test("buildGenerationResultMedia maps photoshoot sidecars to four thumbs", () => {
  const tiles = [
    "u/lease-1.jpg",
    "u/lease-2.jpg",
    "u/lease-3.jpg",
    "u/lease-4.jpg",
  ];
  const media = buildGenerationResultMedia({
    bucket: "web-generation-results",
    editKind: "photoshoot",
    sheetPath: "u/lease.jpg",
    tilePaths: tiles,
    toPublicUrl: (_bucket, path) => `full/${path}`,
    toListingUrl: (_bucket, path) => `thumb/${path}`,
  });
  assert.equal(media.resultUrl, "full/u/lease-1.jpg");
  assert.equal(media.resultThumbUrl, "thumb/u/lease-1.jpg");
  assert.equal(media.photoshootSheetUrl, "full/u/lease.jpg");
  assert.equal(media.photoshootSheetThumbUrl, "thumb/u/lease.jpg");
  assert.deepEqual(media.photoshootTileUrls, tiles.map((path) => `full/${path}`));
  assert.deepEqual(
    media.photoshootTileThumbUrls,
    tiles.map((path) => `thumb/${path}`),
  );
});

test("generationGridDisplay prefers listing thumbs and keeps full tiles for actions", () => {
  const display = generationGridDisplay({
    resultUrl: "full/a.jpg",
    resultThumbUrl: "thumb/a.jpg",
    photoshootTileUrls: ["full/1.jpg", "full/2.jpg", "full/3.jpg", "full/4.jpg"],
    photoshootTileThumbUrls: ["t/1.jpg", "t/2.jpg", "t/3.jpg", "t/4.jpg"],
  });
  assert.deepEqual(display.fullTiles, [
    "full/1.jpg",
    "full/2.jpg",
    "full/3.jpg",
    "full/4.jpg",
  ]);
  assert.deepEqual(display.displayTiles, ["t/1.jpg", "t/2.jpg", "t/3.jpg", "t/4.jpg"]);
  assert.equal(display.displaySrc, "thumb/a.jpg");
});
