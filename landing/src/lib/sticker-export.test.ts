import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { STICKER_PLATFORMS } from "./sticker";
import { crispStickerFringe, exportStickerForPlatform } from "./sticker-export";

test("crispStickerFringe hardens the white border and erases a faint white square", async () => {
  const source = await sharp({
    create: { width: 32, height: 32, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: await sharp({
          create: { width: 8, height: 8, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0.35 } },
        })
          .png()
          .toBuffer(),
        left: 2,
        top: 2,
      },
      {
        input: await sharp({
          create: { width: 8, height: 8, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
        })
          .png()
          .toBuffer(),
        left: 16,
        top: 16,
      },
    ])
    .png()
    .toBuffer();
  const crisped = await crispStickerFringe(source);
  const { data } = await sharp(crisped).raw().toBuffer({ resolveWithObject: true });
  assert.equal(data[3], 0, "faint square pixel is gone");
  const border = (16 * 32 + 16) * 4;
  assert.equal(data[border + 3], 255, "solid white stays solid");
  assert.equal(data[border], 255);
});

test("exportStickerForPlatform keeps a soft white edge unless the row has a border", async () => {
  const width = 512;
  const height = 512;
  const rgba = Buffer.alloc(width * height * 4);
  const offset = (256 * width + 256) * 4;
  rgba[offset] = 255;
  rgba[offset + 1] = 255;
  rgba[offset + 2] = 255;
  rgba[offset + 3] = 90; // soft near-white pixel, e.g. a white sweater hem
  const source = await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
  const max = STICKER_PLATFORMS.find((platform) => platform.id === "max");
  assert.ok(max);
  const plain = await exportStickerForPlatform(source, max);
  const plainRaw = await sharp(plain.buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(plainRaw.data[offset + 3], 90, "plain sticker keeps the soft edge");
  const bordered = await exportStickerForPlatform(source, max, { hasBorder: true });
  const borderedRaw = await sharp(bordered.buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(borderedRaw.data[offset + 3], 0, "border row snaps the faint white pixel away");
});

test("exportStickerForPlatform telegram webp is 512 and under 512 KB", async () => {
  const png = await sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: await sharp({
          create: { width: 200, height: 200, channels: 4, background: { r: 34, g: 68, b: 204, alpha: 1 } },
        })
          .png()
          .toBuffer(),
        left: 156,
        top: 156,
      },
    ])
    .png()
    .toBuffer();
  const telegram = STICKER_PLATFORMS.find((platform) => platform.id === "telegram");
  assert.ok(telegram);
  const exported = await exportStickerForPlatform(png, telegram);
  assert.equal(exported.contentType, "image/webp");
  assert.equal(exported.width, 512);
  assert.ok(exported.buffer.length <= telegram.maxBytes);
});
