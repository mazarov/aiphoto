import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGenerationResultMedia,
  expectedSidecarTileCount,
  generationGridDisplay,
  generationListingAspectRatio,
  isUnknownGenerationsListRpc,
  mergeGenerationFirstPage,
  resolveGenerationUserFacingResult,
  sidecarTileNumberForUrl,
  sidecarTileUrls,
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

test("buildGenerationResultMedia keeps the sticker PNG so alpha is not matted", () => {
  const media = buildGenerationResultMedia({
    bucket: "web-generation-results",
    editKind: "sticker",
    sheetPath: "u/job.png",
    tilePaths: null,
    resultMimeType: "image/png",
    toPublicUrl: (bucket, path) => `full/${bucket}/${path}`,
    toListingUrl: (bucket, path) => `thumb/${bucket}/${path}`,
  });
  assert.equal(media.resultUrl, "full/web-generation-results/u/job.png");
  assert.equal(media.resultThumbUrl, null);
});

test("generationListingAspectRatio uses the file shape and forces stickers to square", () => {
  assert.equal(generationListingAspectRatio("16:9", null), 16 / 9);
  assert.equal(generationListingAspectRatio("3:4", "photoshoot"), 3 / 4);
  assert.equal(generationListingAspectRatio("", null), 3 / 4);
  assert.equal(generationListingAspectRatio("9:16", "sticker"), 1);
});

test("generationGridDisplay prefers listing thumbs and keeps full tiles for actions", () => {
  const display = generationGridDisplay({
    resultUrl: "full/a.jpg",
    resultThumbUrl: "thumb/a.jpg",
    editKind: "photoshoot",
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
  assert.equal(display.gridColumns, 2);
});

test("sidecar tiles: 4 for a photoshoot, 16 for a sticker pack, none otherwise", () => {
  assert.equal(expectedSidecarTileCount("photoshoot"), 4);
  assert.equal(expectedSidecarTileCount("sticker_pack"), 16);
  assert.equal(expectedSidecarTileCount("sticker"), null);
  assert.equal(expectedSidecarTileCount(null), null);

  const four = ["a", "b", "c", "d"];
  const sixteen = Array.from({ length: 16 }, (_, i) => `t/${i + 1}.png`);
  assert.deepEqual(sidecarTileUrls("photoshoot", four), four);
  assert.equal(sidecarTileUrls("photoshoot", sixteen), null);
  assert.deepEqual(sidecarTileUrls("sticker_pack", sixteen), sixteen);
  assert.equal(sidecarTileUrls("sticker_pack", four), null, "a pack never shows 4 of 16");
  assert.equal(sidecarTileUrls("sticker", four), null);
  assert.equal(sidecarTileUrls("sticker_pack", [...sixteen.slice(0, 15), ""]), null);

  assert.equal(sidecarTileNumberForUrl(sixteen, "t/7.png"), 7);
  assert.equal(sidecarTileNumberForUrl(sixteen, "preview.png"), null, "the pack preview is not a tile");
  assert.equal(sidecarTileNumberForUrl(null, "t/1.png"), null);
});

test("sticker pack card: 4×4 grid of the 16 PNGs, preview stays in the single slot", () => {
  const tiles = Array.from({ length: 16 }, (_, i) => `u/j/lease-${String(i + 1).padStart(2, "0")}.png`);
  const display = generationGridDisplay({
    resultUrl: "u/j/lease.png",
    resultThumbUrl: null,
    editKind: "sticker_pack",
    photoshootTileUrls: tiles,
    photoshootTileThumbUrls: tiles,
  });
  assert.equal(display.gridColumns, 4);
  assert.equal(display.fullTiles?.length, 16);
  assert.equal(display.displaySrc, "u/j/lease.png");

  const facing = resolveGenerationUserFacingResult({
    editKind: "sticker_pack",
    sheetPath: "u/j/lease.png",
    tilePaths: null,
  });
  assert.equal(facing.resultPath, "u/j/lease.png");
  assert.equal(facing.tilePaths?.length, 16);
  assert.equal(facing.tilePaths?.[15], "u/j/lease-16.png");

  const photoshoot = resolveGenerationUserFacingResult({
    editKind: "photoshoot",
    sheetPath: "u/j/sheet.jpg",
    tilePaths: null,
  });
  assert.equal(photoshoot.resultPath, "u/j/sheet-1.jpg");
  assert.equal(photoshoot.tilePaths?.length, 4);
});
