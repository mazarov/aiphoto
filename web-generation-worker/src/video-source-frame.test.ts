import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  coverCropOutputSize,
  coverCropVideoFrame,
  isAlreadyCoverAspect,
  resolveVideoFrameAspect,
} from "./video-source-frame";

async function solidPng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 40, g: 80, b: 120 } },
  })
    .png()
    .toBuffer();
}

test("resolveVideoFrameAspect only allows 9:16 and 16:9", () => {
  assert.equal(resolveVideoFrameAspect("16:9"), "16:9");
  assert.equal(resolveVideoFrameAspect("9:16"), "9:16");
  assert.equal(resolveVideoFrameAspect("1:1"), "9:16");
});

test("cover crop size for a square source matches the video frame", () => {
  assert.deepEqual(coverCropOutputSize(1024, 1024, "9:16"), { width: 576, height: 1024 });
  assert.deepEqual(coverCropOutputSize(1024, 1024, "16:9"), { width: 1024, height: 576 });
  assert.equal(isAlreadyCoverAspect(1080, 1920, "9:16"), true);
  assert.equal(isAlreadyCoverAspect(1024, 1024, "9:16"), false);
});

test("coverCropVideoFrame crops 1:1 to 9:16 without stretching", async () => {
  const png = await solidPng(64, 64);
  const frame = await coverCropVideoFrame(png, "9:16");
  const meta = await sharp(frame.buffer).metadata();
  assert.equal(frame.cropped, true);
  assert.equal(frame.mimeType, "image/jpeg");
  assert.equal(frame.sourceWidth, 64);
  assert.equal(frame.sourceHeight, 64);
  assert.equal(meta.width, 36);
  assert.equal(meta.height, 64);
});

test("coverCropVideoFrame leaves an already-matching frame untouched", async () => {
  const png = await solidPng(36, 64);
  const frame = await coverCropVideoFrame(png, "9:16");
  assert.equal(frame.cropped, false);
  assert.equal(frame.buffer.equals(png), true);
  assert.equal(frame.mimeType, "image/png");
});
