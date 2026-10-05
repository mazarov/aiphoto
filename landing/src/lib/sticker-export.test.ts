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
