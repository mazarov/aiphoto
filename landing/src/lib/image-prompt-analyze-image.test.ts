import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  ANALYZE_GEMINI_MAX_BYTES,
  ANALYZE_GEMINI_MAX_EDGE,
  AnalyzeImageError,
  parseAnalyzeImageBuffer,
  parseAnalyzeImageDataUrl,
  prepareAnalyzeImageForGemini,
  resolveAnalyzeImageFromBody,
} from "./image-prompt-analyze-image";

const PNG_1X1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test("parseAnalyzeImageDataUrl accepts a tiny PNG data URL", () => {
  const parsed = parseAnalyzeImageDataUrl(PNG_1X1);
  assert.ok(parsed);
  assert.equal(parsed?.mimeType, "image/png");
  assert.ok(parsed && parsed.data.length > 0);
});

test("parseAnalyzeImageBuffer accepts the same tiny PNG bytes", () => {
  const parsedUrl = parseAnalyzeImageDataUrl(PNG_1X1);
  assert.ok(parsedUrl);
  const parsed = parseAnalyzeImageBuffer(Buffer.from(parsedUrl!.data, "base64"));
  assert.ok(parsed);
  assert.equal(parsed?.mimeType, "image/png");
  assert.equal(parsed?.data, parsedUrl?.data);
});

test("parseAnalyzeImageBuffer rejects empty and junk", () => {
  assert.equal(parseAnalyzeImageBuffer(Buffer.alloc(0)), null);
  assert.equal(parseAnalyzeImageBuffer(Buffer.from("not-an-image")), null);
});

test("parseAnalyzeImageDataUrl rejects junk", () => {
  assert.equal(parseAnalyzeImageDataUrl("not-a-data-url"), null);
  assert.equal(parseAnalyzeImageDataUrl("data:image/png;base64,@@@@"), null);
});

test("prepareAnalyzeImageForGemini fails closed instead of sending the original", async () => {
  await assert.rejects(
    () =>
      prepareAnalyzeImageForGemini(
        { mimeType: "image/jpeg", data: Buffer.from("not-a-jpeg").toString("base64") },
        { maxEdge: 256, maxBytes: 20 * 1024 },
      ),
    (error: unknown) =>
      error instanceof AnalyzeImageError && error.code === "gemini_payload",
  );
});

test("prepareAnalyzeImageForGemini keeps a noisy portrait under the byte budget", async () => {
  const pixels = Buffer.alloc(1024 * 1280 * 3);
  for (let i = 0; i < pixels.length; i += 1) {
    pixels[i] = (i * 17 + (i % 251)) % 256;
  }
  const large = await sharp(pixels, {
    raw: { width: 1024, height: 1280, channels: 3 },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  const parsed = parseAnalyzeImageBuffer(large);
  assert.ok(parsed);
  assert.ok(Buffer.from(parsed.data, "base64").length > ANALYZE_GEMINI_MAX_BYTES);
  const prepared = await prepareAnalyzeImageForGemini(parsed);
  const bytes = Buffer.from(prepared.data, "base64").length;
  const meta = await sharp(Buffer.from(prepared.data, "base64")).metadata();
  assert.equal(prepared.mimeType, "image/jpeg");
  assert.ok((meta.width ?? 0) <= ANALYZE_GEMINI_MAX_EDGE);
  assert.ok((meta.height ?? 0) <= ANALYZE_GEMINI_MAX_EDGE);
  assert.ok(bytes <= ANALYZE_GEMINI_MAX_BYTES);
});

test("prepareAnalyzeImageForGemini downscales a large JPEG for Gemini", async () => {
  const large = await sharp({
    create: {
      width: 1600,
      height: 1200,
      channels: 3,
      background: { r: 40, g: 40, b: 40 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  const parsed = parseAnalyzeImageBuffer(large);
  assert.ok(parsed);
  const prepared = await prepareAnalyzeImageForGemini(parsed);
  assert.equal(prepared.mimeType, "image/jpeg");
  const meta = await sharp(Buffer.from(prepared.data, "base64")).metadata();
  const bytes = Buffer.from(prepared.data, "base64").length;
  assert.ok((meta.width ?? 0) <= ANALYZE_GEMINI_MAX_EDGE);
  assert.ok((meta.height ?? 0) <= ANALYZE_GEMINI_MAX_EDGE);
  assert.ok(bytes <= ANALYZE_GEMINI_MAX_BYTES);
  assert.ok(prepared.data.length < parsed.data.length);
});

test("resolveAnalyzeImageFromBody requires exactly one image field", async () => {
  assert.equal((await resolveAnalyzeImageFromBody({})).ok, false);
  assert.equal(
    (await resolveAnalyzeImageFromBody({ image_base64: PNG_1X1, image_url: "https://x" })).ok,
    false,
  );
  const ok = await resolveAnalyzeImageFromBody({ image_base64: PNG_1X1 });
  assert.equal(ok.ok, true);
});
