import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import sharp from "sharp";
import {
  detectImageKind,
  encodeGenerationResult,
  JPEG_QUALITY,
} from "./result-encode";

async function noisyPng(width: number, height: number): Promise<Buffer> {
  return sharp(randomBytes(width * height * 3), {
    raw: { width, height, channels: 3 },
  })
    .png()
    .toBuffer();
}

test("detectImageKind reads jpeg png webp magic bytes", async () => {
  const jpeg = await sharp({
    create: { width: 2, height: 2, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .jpeg()
    .toBuffer();
  const png = await sharp({
    create: { width: 2, height: 2, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .png()
    .toBuffer();
  const webp = await sharp({
    create: { width: 2, height: 2, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .webp()
    .toBuffer();

  assert.equal(detectImageKind(jpeg), "jpeg");
  assert.equal(detectImageKind(png), "png");
  assert.equal(detectImageKind(webp), "webp");
  assert.equal(detectImageKind(Buffer.from("not-an-image")), "unknown");
});

test("noisy PNG encodes to smaller JPEG without resizing", async () => {
  const png = await noisyPng(256, 256);
  const inputMeta = await sharp(png).metadata();
  const result = await encodeGenerationResult(png);
  const outputMeta = await sharp(result.buffer).metadata();

  assert.equal(result.outputFormat, "jpeg");
  assert.equal(result.extension, "jpg");
  assert.equal(result.contentType, "image/jpeg");
  assert.equal(result.skippedReason, null);
  assert.equal(result.bytesIn, png.length);
  assert.equal(result.bytesOut, result.buffer.length);
  assert.ok(result.bytesOut < result.bytesIn);
  assert.equal(outputMeta.format, "jpeg");
  assert.equal(outputMeta.width, inputMeta.width);
  assert.equal(outputMeta.height, inputMeta.height);
  assert.equal(JPEG_QUALITY, 85);
});

test("already JPEG is uploaded as-is", async () => {
  const jpeg = await sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 80, g: 10, b: 10 } },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  const result = await encodeGenerationResult(jpeg);

  assert.equal(result.skippedReason, "already_jpeg");
  assert.equal(result.outputFormat, "jpeg");
  assert.equal(result.extension, "jpg");
  assert.equal(result.contentType, "image/jpeg");
  assert.equal(result.bytesOut, jpeg.length);
  assert.ok(result.buffer.equals(jpeg));
});

test("tiny PNG keeps original when JPEG is larger", async () => {
  const png = await sharp({
    create: { width: 1, height: 1, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
  const result = await encodeGenerationResult(png);

  assert.equal(result.skippedReason, "no_gain");
  assert.equal(result.outputFormat, "png");
  assert.equal(result.extension, "png");
  assert.equal(result.contentType, "image/png");
  assert.ok(result.buffer.equals(png));
});

test("transparent PNG flattens onto white", async () => {
  const width = 128;
  const height = 128;
  const raw = Buffer.alloc(width * height * 4);
  const rgb = randomBytes(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    raw[i * 4] = rgb[i * 3];
    raw[i * 4 + 1] = rgb[i * 3 + 1];
    raw[i * 4 + 2] = rgb[i * 3 + 2];
    raw[i * 4 + 3] = 0;
  }
  const png = await sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer();
  const result = await encodeGenerationResult(png);
  const { data, info } = await sharp(result.buffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  assert.equal(result.outputFormat, "jpeg");
  assert.equal(info.channels, 3);
  assert.ok(data[0] > 240 && data[1] > 240 && data[2] > 240);
});

test("invalid buffer falls back without throwing", async () => {
  const original = Buffer.from("not-an-image");
  const result = await encodeGenerationResult(original);

  assert.equal(result.skippedReason, "encode_failed");
  assert.equal(result.outputFormat, "original");
  assert.equal(result.extension, "png");
  assert.equal(result.contentType, "image/png");
  assert.ok(result.buffer.equals(original));
});
