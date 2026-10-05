import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  clearChromaFringe,
  composeStickerFromCutout,
  dilateAlpha,
  finalizeStickerImage,
  flattenStickerSourceForEdit,
  removeBackgroundViaRembg,
} from "./sticker-finalize";
import { ProcessingError } from "./input-source";

test("flattenStickerSourceForEdit paints transparency magenta and keeps the figure", async () => {
  const flat = await flattenStickerSourceForEdit(await syntheticCutout());
  assert.equal(flat.mimeType, "image/png");
  const { data, info } = await sharp(flat.buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 4);
  // corner pixel was transparent → now opaque magenta
  assert.deepEqual([data[0], data[1], data[2], data[3]], [255, 0, 255, 255]);
  // inside the blob stays blue
  const idx = (100 * info.width + 60) * 4;
  assert.deepEqual([data[idx], data[idx + 1], data[idx + 2]], [0x22, 0x44, 0xcc]);
});

async function syntheticCutout(): Promise<Buffer> {
  // 200×300 transparent canvas with an opaque blue rounded blob offset to a corner.
  const blob = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300">
      <rect x="20" y="40" width="90" height="140" rx="30" fill="#2244cc"/>
    </svg>`,
  );
  return sharp(blob).png().toBuffer();
}

test("dilateAlpha grows opaque region by radius in both axes", () => {
  const w = 7;
  const h = 7;
  const alpha = new Uint8Array(w * h);
  alpha[3 * w + 3] = 255;
  const out = dilateAlpha(alpha, w, h, 2);
  assert.equal(out[1 * w + 3], 255);
  assert.equal(out[3 * w + 1], 255);
  assert.equal(out[5 * w + 5], 255);
  assert.equal(out[0], 0);
});

test("clearChromaFringe zeroes magenta pixels and keeps others", () => {
  const rgba = Buffer.from([
    255, 0, 255, 255, // pure magenta → cleared
    250, 10, 240, 200, // near magenta → cleared
    20, 200, 30, 255, // green → kept
  ]);
  const cleared = clearChromaFringe(rgba, 3, 1);
  assert.equal(cleared, 2);
  assert.equal(rgba[3], 0);
  assert.equal(rgba[7], 0);
  assert.equal(rgba[11], 255);
});

test("composeStickerFromCutout yields 512×512 PNG with alpha and a white border", async () => {
  const cutout = await syntheticCutout();
  const result = await composeStickerFromCutout(cutout);
  const meta = await sharp(result.buffer).metadata();
  assert.equal(meta.format, "png");
  assert.equal(meta.width, 512);
  assert.equal(meta.height, 512);
  assert.equal(meta.hasAlpha, true);

  const { data, info } = await sharp(result.buffer).raw().toBuffer({ resolveWithObject: true });
  let transparent = 0;
  let white = 0;
  let blue = 0;
  for (let i = 0; i < info.width * info.height; i += 1) {
    const o = i * 4;
    if (data[o + 3] === 0) transparent += 1;
    else if (data[o] > 240 && data[o + 1] > 240 && data[o + 2] > 240) white += 1;
    else if (data[o + 2] > 150 && data[o] < 100) blue += 1;
  }
  assert.ok(transparent > 0, "corners stay transparent");
  assert.ok(white > 0, "outline is painted");
  assert.ok(blue > white, "subject dominates the outline");
});

test("removeBackgroundViaRembg fails fast without REMBG_URL", async () => {
  await assert.rejects(
    removeBackgroundViaRembg(await syntheticCutout(), { rembgUrl: "" }),
    (error: unknown) =>
      error instanceof ProcessingError && error.errorType === "config_error" && !error.retryable,
  );
});

test("removeBackgroundViaRembg marks 5xx as retryable and 4xx as fatal", async () => {
  const input = await syntheticCutout();
  const fetch500 = (async () => new Response("boom", { status: 500 })) as unknown as typeof fetch;
  await assert.rejects(
    removeBackgroundViaRembg(input, { rembgUrl: "http://rembg.test", fetchImpl: fetch500 }),
    (error: unknown) =>
      error instanceof ProcessingError &&
      error.errorType === "sticker_background_error" &&
      error.retryable,
  );
  const fetch400 = (async () => new Response("bad", { status: 400 })) as unknown as typeof fetch;
  await assert.rejects(
    removeBackgroundViaRembg(input, { rembgUrl: "http://rembg.test", fetchImpl: fetch400 }),
    (error: unknown) =>
      error instanceof ProcessingError &&
      error.errorType === "sticker_background_error" &&
      !error.retryable,
  );
});

test("finalizeStickerImage returns a PNG EncodedGenerationResult via a stubbed rembg", async () => {
  const cutout = await syntheticCutout();
  let calledUrl = "";
  const fetchStub = (async (url: string | URL | Request, init?: RequestInit) => {
    calledUrl = String(url);
    assert.ok(init?.body instanceof FormData);
    return new Response(new Uint8Array(cutout), { status: 200, headers: { "content-type": "image/png" } });
  }) as unknown as typeof fetch;
  const result = await finalizeStickerImage(cutout, { rembgUrl: "http://rembg.test/", fetchImpl: fetchStub });
  assert.equal(calledUrl, "http://rembg.test/remove-background");
  assert.equal(result.extension, "png");
  assert.equal(result.contentType, "image/png");
  assert.equal(result.outputFormat, "png");
  assert.equal(result.sticker.width, 512);
  assert.equal(result.sticker.rembgAttempts, 1);
  const meta = await sharp(result.buffer).metadata();
  assert.equal(meta.hasAlpha, true);
});
