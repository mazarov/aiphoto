import assert from "node:assert/strict";
import test from "node:test";
import {
  STICKER_PACK_CELL_PX,
  STICKER_PACK_COUNT,
  STICKER_PACK_SHEET_PX,
  isStickerPackExampleUrl,
  isStickerPackId,
  packExamplesFromRows,
  stickerPackCellBox,
  stickerPackContentPx,
  stickerPackExampleUrl,
  stickerPackGrid,
} from "./sticker-pack-examples";

const ORIGIN = "https://cdn.example.test";

test("16 stickers are a 4×4 sheet of 512 px cells on a 2048 canvas", () => {
  assert.equal(STICKER_PACK_COUNT, 16);
  assert.equal(STICKER_PACK_SHEET_PX, 2048);
  assert.deepEqual(stickerPackGrid(16), { cols: 4, rows: 4 });
  assert.equal(STICKER_PACK_CELL_PX, 512);
  assert.deepEqual(stickerPackCellBox(0), { left: 0, top: 0, width: 512, height: 512 });
  assert.deepEqual(stickerPackCellBox(5), { left: 512, top: 512, width: 512, height: 512 });
  assert.deepEqual(stickerPackCellBox(15), { left: 1536, top: 1536, width: 512, height: 512 });
  assert.equal(stickerPackCellBox(16), null);
});

test("older 9-sticker packs stay 3×3", () => {
  assert.deepEqual(stickerPackGrid(9), { cols: 3, rows: 3 });
  assert.deepEqual(stickerPackCellBox(4, 9, 1024), { left: 341, top: 341, width: 341, height: 341 });
});

test("5% margin shrinks the 512 cell to 461 px of artwork", () => {
  assert.equal(stickerPackContentPx(), 461);
});

test("example URL stays inside the public pack folder", () => {
  const url = stickerPackExampleUrl("pack_daily_reactions_women_v1", ORIGIN);
  assert.equal(
    url,
    `${ORIGIN}/storage/v1/object/public/stickers-examples/sticker_pack_example/pack_daily_reactions_women_v1/example.webp`,
  );
  assert.equal(isStickerPackExampleUrl(url, ORIGIN), true);
  assert.equal(stickerPackExampleUrl("../stickers/secret", ORIGIN), null);
  assert.equal(stickerPackExampleUrl("ok", "http://insecure.example"), null);
  assert.equal(isStickerPackId("mq8-queen-001"), true);
  assert.equal(isStickerPackId("has space"), false);
});

test("a pack is listed only when the set and the example folder both exist", () => {
  const packs = packExamplesFromRows(
    [
      { id: "b", name_ru: "Второй", carousel_description_ru: "два", sort_order: 2, sticker_count: 16 },
      { id: "a", name_ru: "Первый", carousel_description_ru: "один", sort_order: 1, sticker_count: 16 },
      { id: "gone", name_ru: "Без файла", carousel_description_ru: "", sort_order: 0, sticker_count: 16 },
      { id: "bad/id", name_ru: "Мусор", carousel_description_ru: "", sort_order: 3, sticker_count: 16 },
    ],
    new Set(["a", "b", "orphan-folder", "bad/id"]),
    ORIGIN,
  );
  assert.deepEqual(
    packs.map((pack) => pack.id),
    ["a", "b"],
  );
  assert.equal(packs[0]?.name, "Первый");
  assert.equal(packs[0]?.description, "один");
});
