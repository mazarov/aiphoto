import assert from "node:assert/strict";
import test from "node:test";
import {
  STICKER_PACK_CELL_PX,
  STICKER_PACK_COUNT,
  STICKER_PACK_DEFAULT_CREDIT_COST,
  STICKER_PACK_EDIT_KIND,
  STICKER_PACK_PROVIDER_SHEET_PX,
  STICKER_PACK_SHEET_CELLS,
  STICKER_PACK_SHEET_COUNT,
  STICKER_PACK_UPSCALED_SHEET_PX,
  assembleStickerPackSheetPrompt,
  buildStickerPackPromptText,
  deriveStickerPackTilePaths,
  isSidecarTileCount,
  isStickerPackEditKind,
  isStickerPackPromptText,
  normalizeStickerPackScenes,
  parseStickerPackCreditCost,
  parseStickerPackPrompt,
  parseStickerPackTileNumber,
  parseStickerPackTilePaths,
  resolveStickerPackUserFacingResult,
  resolveStickerSourcePath,
  stickerPackCellBox,
  stickerPackFingerprintFields,
  stickerPackSheetScenes,
  stickerPackStickerIndex,
  stickerPackTileFilename,
  stickerPackTileStoragePath,
} from "./sticker-pack";
import { stickerPackCellBox as exampleCellBox, STICKER_PACK_SHEET_PX } from "./sticker-pack-examples";

const SCENES = Array.from({ length: 16 }, (_, i) => `{subject} scene ${i + 1}, gaze at camera`);

test("16 stickers = one 1024 sheet scaled to 1512 → 378 px cells", () => {
  assert.equal(STICKER_PACK_COUNT, 16);
  assert.equal(STICKER_PACK_SHEET_COUNT, 1);
  assert.equal(STICKER_PACK_SHEET_CELLS, 16);
  assert.equal(STICKER_PACK_PROVIDER_SHEET_PX, 1024);
  assert.equal(STICKER_PACK_UPSCALED_SHEET_PX, 1512);
  assert.equal(STICKER_PACK_CELL_PX, 378);
  assert.deepEqual(stickerPackCellBox(0, 16, 1512), { left: 0, top: 0, width: 378, height: 378 });
  assert.deepEqual(stickerPackCellBox(5, 16, 1512), { left: 378, top: 378, width: 378, height: 378 });
  assert.deepEqual(stickerPackCellBox(0, 4, 1024), { left: 0, top: 0, width: 512, height: 512 });
  assert.deepEqual(stickerPackCellBox(3, 4, 1024), { left: 512, top: 512, width: 512, height: 512 });
  assert.deepEqual(stickerPackCellBox(1, 4, 1536, 1024), { left: 768, top: 0, width: 768, height: 512 });
  assert.equal(stickerPackCellBox(4, 4, 1024), null);
  // The bot example grid keeps its own 2048 / 4×4 defaults.
  assert.equal(STICKER_PACK_SHEET_PX, 2048);
  assert.deepEqual(exampleCellBox(15), { left: 1536, top: 1536, width: 512, height: 512 });
});

test("sheet scenes and sticker index walk the pack in order", () => {
  const scenes = normalizeStickerPackScenes(SCENES)!;
  assert.deepEqual(stickerPackSheetScenes(scenes, 0), scenes);
  assert.deepEqual(stickerPackSheetScenes(scenes, 1), []);
  assert.equal(stickerPackStickerIndex(0, 0), 0);
  assert.equal(stickerPackStickerIndex(0, 15), 15);
});

test("scene normalization: 16 lines, {subject} replaced, empty → null", () => {
  const scenes = normalizeStickerPackScenes(SCENES);
  assert.ok(scenes);
  assert.equal(scenes[0], "the person scene 1, gaze at camera");
  assert.equal(normalizeStickerPackScenes(SCENES.slice(0, 9)), null);
  assert.equal(normalizeStickerPackScenes([...SCENES.slice(0, 15), "   "]), null);
  assert.equal(normalizeStickerPackScenes("not an array"), null);
});

test("prompt_text round-trips marker, style block and 16 scenes", () => {
  const text = buildStickerPackPromptText({
    styleId: "cartoon",
    setId: "office_day",
    stylePrompt: "Modern 2D cartoon illustration.\nBold line art.",
    scenes: SCENES,
  });
  assert.ok(isStickerPackPromptText(text));
  assert.match(text, /^STICKER_PACK style=cartoon set=office_day count=16\n/);
  const spec = parseStickerPackPrompt(text);
  assert.ok(spec);
  assert.equal(spec.styleId, "cartoon");
  assert.equal(spec.setId, "office_day");
  assert.equal(spec.stylePrompt, "Modern 2D cartoon illustration.\nBold line art.");
  assert.equal(spec.scenes.length, 16);
  assert.equal(spec.scenes[15], "the person scene 16, gaze at camera");
  assert.equal(parseStickerPackPrompt("STICKER style=cartoon\nfoo"), null);
  assert.equal(parseStickerPackPrompt(text.replace("16. ", "17. ")), null);
  assert.throws(() => buildStickerPackPromptText({ styleId: "bad id", setId: "x", stylePrompt: "s", scenes: SCENES }));
  assert.throws(() => buildStickerPackPromptText({ styleId: "a", setId: "x", stylePrompt: "", scenes: SCENES }));
});

test("sheet prompt carries 16 numbered scenes and the background mode", () => {
  const scenes = stickerPackSheetScenes(normalizeStickerPackScenes(SCENES)!, 0);
  const transparent = assembleStickerPackSheetPrompt({ stylePrompt: "Anime style.", scenes, mode: "transparent" });
  assert.match(transparent, /^Anime style\./);
  assert.match(transparent, /4x4 grid \(16 cells/);
  assert.match(transparent, /1\. the person scene 1, gaze at camera/);
  assert.match(transparent, /16\. the person scene 16, gaze at camera/);
  assert.match(transparent, /fully TRANSPARENT/);
  assert.doesNotMatch(transparent, /MAGENTA/);
  const magenta = assembleStickerPackSheetPrompt({ stylePrompt: "Anime style.", scenes });
  assert.match(magenta, /BRIGHT MAGENTA \(#FF00FF\)/);
  assert.match(magenta, /11\. Avoid magenta/);
  assert.throws(() => assembleStickerPackSheetPrompt({ stylePrompt: "x", scenes: scenes.slice(0, 3) }));
});

test("tile paths: lease-01.png … lease-16.png next to the preview", () => {
  const preview = "user/job/lease.png";
  assert.equal(stickerPackTileStoragePath(preview, 1), "user/job/lease-01.png");
  assert.equal(stickerPackTileStoragePath(preview, 16), "user/job/lease-16.png");
  assert.equal(stickerPackTileStoragePath(preview, 17), "");
  assert.equal(stickerPackTileStoragePath(preview, 0), "");
  const derived = deriveStickerPackTilePaths(preview);
  assert.equal(derived?.length, 16);
  assert.deepEqual(parseStickerPackTilePaths(derived), derived);
  assert.deepEqual(parseStickerPackTilePaths(JSON.stringify(derived)), derived);
  assert.equal(parseStickerPackTilePaths(derived!.slice(0, 4)), null);
  assert.ok(isSidecarTileCount(4));
  assert.ok(isSidecarTileCount(16));
  assert.equal(isSidecarTileCount(9), false);
});

test("user-facing result: preview in the single slot, 16 stickers as tiles", () => {
  const facing = resolveStickerPackUserFacingResult({
    editKind: STICKER_PACK_EDIT_KIND,
    previewPath: "u/j/lease.png",
    tilePaths: null,
  });
  assert.ok(facing);
  assert.equal(facing.resultPath, "u/j/lease.png");
  assert.equal(facing.tilePaths?.[0], "u/j/lease-01.png");
  assert.equal(resolveStickerPackUserFacingResult({ editKind: "photoshoot", previewPath: "x.jpg" }), null);
  assert.ok(isStickerPackEditKind("sticker_pack"));
  assert.equal(isStickerPackEditKind("sticker"), false);
});

test("sticker routes: single row → result path, pack row → the chosen tile, preview never", () => {
  const isSingle = (kind: unknown) => kind === "sticker";
  assert.deepEqual(
    resolveStickerSourcePath({ editKind: "sticker", resultPath: "u/j/sticker.png", isSingleSticker: isSingle }),
    { ok: true, path: "u/j/sticker.png", isPack: false, tile: null },
  );
  const pack = { editKind: STICKER_PACK_EDIT_KIND, resultPath: "u/j/lease.png", tilePaths: null, isSingleSticker: isSingle };
  assert.deepEqual(resolveStickerSourcePath({ ...pack, tile: "7" }), {
    ok: true,
    path: "u/j/lease-07.png",
    isPack: true,
    tile: 7,
  });
  assert.deepEqual(resolveStickerSourcePath({ ...pack }), { ok: false, reason: "tile_required" });
  assert.deepEqual(resolveStickerSourcePath({ ...pack, tile: 17 }), { ok: false, reason: "tile_required" });
  assert.deepEqual(
    resolveStickerSourcePath({ ...pack, tile: 3, tilePaths: ["a", "b"] }),
    { ok: true, path: "u/j/lease-03.png", isPack: true, tile: 3 },
    "a short sidecar list falls back to paths derived from the preview",
  );
  assert.deepEqual(
    resolveStickerSourcePath({ editKind: "photoshoot", resultPath: "u/j/sheet.jpg", tile: 1, isSingleSticker: isSingle }),
    { ok: false, reason: "not_sticker" },
  );
  assert.equal(parseStickerPackTileNumber("16"), 16);
  assert.equal(parseStickerPackTileNumber(0), null);
  assert.equal(parseStickerPackTileNumber(""), null);
  assert.equal(stickerPackTileFilename(7), "sticker-07.png");
  assert.equal(stickerPackTileFilename(16, "webp"), "sticker-16.webp");
});

test("credit cost: DB integer wins, junk → 20", () => {
  assert.equal(STICKER_PACK_DEFAULT_CREDIT_COST, 20);
  assert.equal(parseStickerPackCreditCost(undefined), 20);
  assert.equal(parseStickerPackCreditCost("25"), 25);
  assert.equal(parseStickerPackCreditCost("0"), 0);
  assert.equal(parseStickerPackCreditCost("-3"), 20);
  assert.equal(parseStickerPackCreditCost("abc"), 20);
  assert.deepEqual(stickerPackFingerprintFields(" p ", "cartoon", "office_day"), {
    editKind: "sticker_pack",
    photoStoragePath: "p",
    stickerStyleId: "cartoon",
    stickerPackSetId: "office_day",
  });
});
