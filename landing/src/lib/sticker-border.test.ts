import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { addWhiteBorderToStickerPng } from "./sticker-border";

async function squareSticker(): Promise<Buffer> {
  return sharp({
    create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: await sharp({
          create: { width: 20, height: 20, channels: 4, background: { r: 20, g: 40, b: 200, alpha: 1 } },
        })
          .png()
          .toBuffer(),
        left: 22,
        top: 22,
      },
    ])
    .png()
    .toBuffer();
}

async function countWhite(png: Buffer): Promise<number> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let white = 0;
  for (let i = 0; i < info.width * info.height; i += 1) {
    const o = i * 4;
    if (data[o + 3] > 0 && data[o] > 240 && data[o + 1] > 240 && data[o + 2] > 240) white += 1;
  }
  return white;
}

test("border width in px controls the ring: thicker request → more white, out-of-range is clamped", async () => {
  const source = await squareSticker();
  const thin = await countWhite(await addWhiteBorderToStickerPng(source, 2));
  const mid = await countWhite(await addWhiteBorderToStickerPng(source, 8));
  const thick = await countWhite(await addWhiteBorderToStickerPng(source, 16));
  assert.ok(thin > 0, "2px still paints a ring");
  assert.ok(mid > thin, "8px ring is wider than 2px");
  assert.ok(thick > mid, "16px ring is wider than 8px");

  const clampedHigh = await countWhite(await addWhiteBorderToStickerPng(source, 10_000));
  const max = await countWhite(await addWhiteBorderToStickerPng(source, 32));
  assert.equal(clampedHigh, max, "above max behaves like max");
  const clampedLow = await countWhite(await addWhiteBorderToStickerPng(source, -3));
  const min = await countWhite(await addWhiteBorderToStickerPng(source, 1));
  assert.equal(clampedLow, min, "below min behaves like min");
});

test("addWhiteBorderToStickerPng paints a white ring and keeps the subject and the canvas", async () => {
  const source = await sharp({
    create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: await sharp({
          create: { width: 20, height: 20, channels: 4, background: { r: 20, g: 40, b: 200, alpha: 1 } },
        })
          .png()
          .toBuffer(),
        left: 22,
        top: 22,
      },
    ])
    .png()
    .toBuffer();

  const out = await addWhiteBorderToStickerPng(source, 4);
  const { data, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 512);
  assert.equal(info.height, 512);

  let white = 0;
  let blue = 0;
  let clear = 0;
  for (let i = 0; i < info.width * info.height; i += 1) {
    const o = i * 4;
    const a = data[o + 3];
    if (a === 0) clear += 1;
    else if (data[o] > 240 && data[o + 1] > 240 && data[o + 2] > 240) white += 1;
    else if (data[o + 2] > 150 && data[o] < 80) blue += 1;
  }
  assert.ok(white > 0, "white ring is painted");
  assert.ok(blue > 0, "blue subject stays");
  assert.ok(clear > 0, "corners stay transparent");
});
