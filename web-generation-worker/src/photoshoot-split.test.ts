import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { splitContactSheet } from "./photoshoot-split";

async function paintQuadrants(width: number, height: number): Promise<Buffer> {
  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);
  const colors = [
    { r: 220, g: 20, b: 20 },
    { r: 20, g: 180, b: 40 },
    { r: 30, g: 60, b: 220 },
    { r: 230, g: 200, b: 20 },
  ];
  const cells = await Promise.all(
    colors.map((color) =>
      sharp({
        create: { width: halfW, height: halfH, channels: 3, background: color },
      })
        .png()
        .toBuffer(),
    ),
  );
  return sharp({
    create: { width, height, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite([
      { input: cells[0], left: 0, top: 0 },
      { input: cells[1], left: halfW, top: 0 },
      { input: cells[2], left: 0, top: halfH },
      { input: cells[3], left: halfW, top: halfH },
    ])
    .jpeg({ quality: 95 })
    .toBuffer();
}

async function sampleCenter(buffer: Buffer): Promise<{ r: number; g: number; b: number }> {
  const meta = await sharp(buffer).metadata();
  const x = Math.floor((meta.width || 2) / 2);
  const y = Math.floor((meta.height || 2) / 2);
  const { data } = await sharp(buffer)
    .extract({ left: x, top: y, width: 1, height: 1 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { r: data[0], g: data[1], b: data[2] };
}

test("splitContactSheet cuts a 1024 sheet into four 512 tiles", async () => {
  const sheet = await paintQuadrants(1024, 1024);
  const split = await splitContactSheet(sheet);
  assert.equal(split.cellWidth, 512);
  assert.equal(split.cellHeight, 512);
  assert.equal(split.tiles.length, 4);
  const samples = await Promise.all(split.tiles.map((tile) => sampleCenter(tile.buffer)));
  assert.ok(samples[0].r > 180 && samples[0].g < 80);
  assert.ok(samples[1].g > 140 && samples[1].r < 80);
  assert.ok(samples[2].b > 180 && samples[2].r < 80);
  assert.ok(samples[3].r > 180 && samples[3].g > 150);
});

test("splitContactSheet drops the leftover pixel on an odd sheet", async () => {
  const sheet = await paintQuadrants(1025, 1025);
  const split = await splitContactSheet(sheet);
  assert.equal(split.sheetWidth, 1025);
  assert.equal(split.cellWidth, 512);
  assert.equal(split.cellHeight, 512);
  assert.equal(split.tiles[3].left, 512);
  assert.equal(split.tiles[3].top, 512);
});
