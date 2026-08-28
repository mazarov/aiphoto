import sharp from "sharp";
import {
  PHOTOSHOOT_TILE_INDEXES,
  type PhotoshootTileIndex,
} from "../../landing/src/lib/photoshoot";
import { JPEG_QUALITY } from "./result-encode";

export type PhotoshootSplitTile = {
  i: PhotoshootTileIndex;
  buffer: Buffer;
  width: number;
  height: number;
  left: number;
  top: number;
};

export type PhotoshootSplitResult = {
  tiles: PhotoshootSplitTile[];
  sheetWidth: number;
  sheetHeight: number;
  cellWidth: number;
  cellHeight: number;
};

/**
 * PackAssemble-style 2×2 cut: floor halves, leftover px on the right/bottom stay unused.
 * Rotate first so EXIF does not shift the grid.
 */
export async function splitContactSheet(input: Buffer): Promise<PhotoshootSplitResult> {
  const rotated = await sharp(input, { failOn: "none" }).rotate().toBuffer();
  const meta = await sharp(rotated, { failOn: "none" }).metadata();
  const sheetWidth = meta.width || 0;
  const sheetHeight = meta.height || 0;
  if (sheetWidth < 4 || sheetHeight < 4) {
    throw new Error("photoshoot_sheet_too_small");
  }
  const cellWidth = Math.floor(sheetWidth / 2);
  const cellHeight = Math.floor(sheetHeight / 2);
  const layout: Array<{ i: PhotoshootTileIndex; left: number; top: number }> = [
    { i: 1, left: 0, top: 0 },
    { i: 2, left: cellWidth, top: 0 },
    { i: 3, left: 0, top: cellHeight },
    { i: 4, left: cellWidth, top: cellHeight },
  ];
  const tiles: PhotoshootSplitTile[] = [];
  for (const cell of layout) {
    const buffer = await sharp(rotated, { failOn: "none" })
      .extract({
        left: cell.left,
        top: cell.top,
        width: cellWidth,
        height: cellHeight,
      })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
    tiles.push({
      i: cell.i,
      buffer,
      width: cellWidth,
      height: cellHeight,
      left: cell.left,
      top: cell.top,
    });
  }
  if (tiles.length !== PHOTOSHOOT_TILE_INDEXES.length) {
    throw new Error("photoshoot_split_incomplete");
  }
  return { tiles, sheetWidth, sheetHeight, cellWidth, cellHeight };
}
