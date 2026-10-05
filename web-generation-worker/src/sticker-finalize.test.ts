import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  chromaKeyMagenta,
  clearChromaFringe,
  composeStickerFromCutout,
  dilateAlpha,
  finalizeStickerImage,
  flattenStickerSourceForEdit,
  magentaRatio,
  pickStickerBgRoute,
  removeBackgroundViaRembg,
  transparentRatio,
} from "./sticker-finalize";
import { ProcessingError } from "./input-source";
import { STICKER_SAFE_MARGIN_PX, assembleStickerFinalPrompt } from "../../landing/src/lib/sticker";

/** What GPT Image returns with `background: "transparent"`: the figure on real alpha, no key colour anywhere. */
async function syntheticAlphaFrame(): Promise<Buffer> {
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
      <rect x="120" y="80" width="160" height="260" rx="40" fill="#2244cc"/>
      <rect x="130" y="60" width="40" height="120" rx="12" fill="#F4A0C8"/>
    </svg>`,
  );
  return sharp(svg).png().toBuffer();
}

/** What the model is asked to paint: flat #FF00FF frame with a figure (blue body, pink hair streak). */
async function syntheticMagentaFrame(): Promise<Buffer> {
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
      <rect width="400" height="400" fill="#FF00FF"/>
      <rect x="120" y="80" width="160" height="260" rx="40" fill="#2244cc"/>
      <rect x="130" y="60" width="40" height="120" rx="12" fill="#F4A0C8"/>
    </svg>`,
  );
  return sharp(svg).png().toBuffer();
}

test("pickStickerBgRoute: thresholds and the rembg flag", () => {
  assert.equal(pickStickerBgRoute(0.6, "chroma_first"), "chroma");
  assert.equal(pickStickerBgRoute(0.2, "chroma_first"), "chroma");
  assert.equal(pickStickerBgRoute(0.1, "chroma_first"), "chroma_rembg");
  assert.equal(pickStickerBgRoute(0.01, "chroma_first"), "rembg");
  assert.equal(pickStickerBgRoute(0.9, "rembg"), "rembg_forced");
  assert.equal(pickStickerBgRoute(0, "chroma_first", 0.6), "alpha_native");
  assert.equal(pickStickerBgRoute(0, "rembg", 0.6), "alpha_native", "real alpha beats the rembg flag");
  assert.equal(pickStickerBgRoute(0, "chroma_first", 0.01), "rembg", "a few clear pixels are not a transparent frame");
});

test("finalizeStickerImage on a real-alpha frame takes alpha_native: no key, no rembg, margin kept", async () => {
  const frame = await syntheticAlphaFrame();
  const { data, info } = await sharp(frame).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = transparentRatio(Buffer.from(data), info.width, info.height);
  assert.ok(alpha > 0.6 && alpha < 0.8, `alpha ratio ${alpha}`);

  let fetchCalls = 0;
  const result = await finalizeStickerImage(frame, {
    rembgUrl: "http://rembg.test",
    bgRoute: "rembg",
    fetchImpl: (async () => {
      fetchCalls += 1;
      return new Response("should not be called", { status: 500 });
    }) as unknown as typeof fetch,
  });
  assert.equal(fetchCalls, 0);
  assert.equal(result.sticker.route, "alpha_native");
  assert.equal(result.sticker.rembgMs, 0);
  assert.equal(result.sticker.chromaKeyedPixels, 0);
  const out = await sharp(result.buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(out.info.width, 512);
  let blue = 0;
  let edgeOpaque = 0;
  for (let y = 0; y < 512; y += 1) {
    for (let x = 0; x < 512; x += 1) {
      const o = (y * 512 + x) * 4;
      const a = out.data[o + 3];
      if (a > 200 && out.data[o + 2] > 150 && out.data[o] < 90) blue += 1;
      if ((y < STICKER_SAFE_MARGIN_PX || y >= 512 - STICKER_SAFE_MARGIN_PX) && a > 0) edgeOpaque += 1;
    }
  }
  assert.ok(blue > 20_000, `blue body survived: ${blue}`);
  assert.equal(edgeOpaque, 0, "safe margin bands stay fully transparent");
});

test("assembleStickerFinalPrompt: magenta vs transparent background mode", () => {
  const raw = "STICKER style=cartoon_telegram\nCartoon portrait, bold outlines";
  const magenta = assembleStickerFinalPrompt(raw);
  assert.match(magenta, /BRIGHT MAGENTA/);
  assert.match(magenta, /background-removed programmatically/);
  const transparent = assembleStickerFinalPrompt(raw, "transparent");
  assert.match(transparent, /fully TRANSPARENT \(alpha channel\)/);
  assert.doesNotMatch(transparent, /MAGENTA|magenta/);
  assert.match(transparent, /Cartoon portrait, bold outlines/);
});

test("magentaRatio + chromaKeyMagenta: key out the flat background, keep blue body and pink hair", async () => {
  const frame = await syntheticMagentaFrame();
  const { data, info } = await sharp(frame).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.from(data);
  const ratio = magentaRatio(rgba, info.width, info.height);
  assert.ok(ratio > 0.6 && ratio < 0.8, `ratio ${ratio}`);
  const keyed = chromaKeyMagenta(rgba, info.width, info.height);
  assert.ok(keyed > info.width * info.height * 0.6);
  const px = (x: number, y: number) => {
    const o = (y * info.width + x) * 4;
    return [rgba[o], rgba[o + 1], rgba[o + 2], rgba[o + 3]];
  };
  assert.equal(px(5, 5)[3], 0, "background corner transparent");
  assert.equal(px(200, 200)[3], 255, "body stays opaque");
  assert.equal(px(150, 100)[3], 255, "pink hair streak survives the key");
});

test("finalizeStickerImage on a magenta frame keys it out without calling rembg and keeps the safe margin", async () => {
  const frame = await syntheticMagentaFrame();
  let fetchCalls = 0;
  const fetchStub = (async () => {
    fetchCalls += 1;
    return new Response("unexpected", { status: 500 });
  }) as unknown as typeof fetch;
  const result = await finalizeStickerImage(frame, { rembgUrl: "http://rembg.test", fetchImpl: fetchStub });
  assert.equal(fetchCalls, 0);
  assert.equal(result.sticker.route, "chroma");
  assert.equal(result.sticker.rembgMs, 0);
  assert.ok(result.sticker.magentaRatio > 0.6);
  const { data, info } = await sharp(result.buffer).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 512);
  // Every pixel inside the safe margin band is transparent → figure never touches the canvas edge.
  const m = STICKER_SAFE_MARGIN_PX;
  for (let x = 0; x < info.width; x += 1) {
    assert.equal(data[((m - 1) * info.width + x) * 4 + 3], 0, `top band x=${x}`);
    assert.equal(data[((info.height - m) * info.width + x) * 4 + 3], 0, `bottom band x=${x}`);
  }
  let blue = 0;
  for (let i = 0; i < info.width * info.height; i += 1) {
    const o = i * 4;
    if (data[o + 3] > 0 && data[o + 2] > 150 && data[o] < 100) blue += 1;
  }
  assert.ok(blue > 20_000, "subject survives at output scale");
});

test("finalizeStickerImage forced to rembg still calls the service on a magenta frame", async () => {
  const frame = await syntheticMagentaFrame();
  const cutout = await syntheticCutout();
  let fetchCalls = 0;
  const fetchStub = (async () => {
    fetchCalls += 1;
    return new Response(new Uint8Array(cutout), { status: 200, headers: { "content-type": "image/png" } });
  }) as unknown as typeof fetch;
  const result = await finalizeStickerImage(frame, { rembgUrl: "http://rembg.test", fetchImpl: fetchStub, bgRoute: "rembg" });
  assert.equal(fetchCalls, 1);
  assert.equal(result.sticker.route, "rembg_forced");
});

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

test("composeStickerFromCutout yields 512×512 PNG with alpha and no white border", async () => {
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
  assert.equal(white, 0, "generation does not paint an outline");
  assert.ok(blue > 0, "subject survives");
  let partial = 0;
  for (let i = 0; i < info.width * info.height; i += 1) {
    const alpha = data[i * 4 + 3];
    if (alpha > 0 && alpha < 255) partial += 1;
  }
  assert.equal(partial, 0, "die-cut is a hard edge, not a blurred halo");
});

test("composeStickerFromCutout drops a faint checker square instead of outlining it", async () => {
  const frame = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">
        <rect x="70" y="50" width="100" height="140" rx="20" fill="#2244cc"/>
        <rect x="8" y="8" width="18" height="18" fill="#ffffff" fill-opacity="0.12"/>
      </svg>`,
    ),
  )
    .png()
    .toBuffer();
  const result = await composeStickerFromCutout(frame, { outlinePx: 8, marginPx: 16 });
  const { data, info } = await sharp(result.buffer).raw().toBuffer({ resolveWithObject: true });
  let speck = 0;
  for (let y = 0; y < 48; y += 1) {
    for (let x = 0; x < 48; x += 1) {
      const offset = (y * info.width + x) * 4;
      if (data[offset + 3] > 0) speck += 1;
    }
  }
  assert.equal(speck, 0, "faint square in the corner does not survive");
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
  // Opaque non-magenta frame (model ignored the key colour, no alpha) → rembg route.
  const opaqueFrame = await sharp(cutout).flatten({ background: "#ffffff" }).png().toBuffer();
  let calledUrl = "";
  const fetchStub = (async (url: string | URL | Request, init?: RequestInit) => {
    calledUrl = String(url);
    assert.ok(init?.body instanceof FormData);
    return new Response(new Uint8Array(cutout), { status: 200, headers: { "content-type": "image/png" } });
  }) as unknown as typeof fetch;
  const result = await finalizeStickerImage(opaqueFrame, { rembgUrl: "http://rembg.test/", fetchImpl: fetchStub });
  assert.equal(calledUrl, "http://rembg.test/remove-background");
  assert.equal(result.sticker.route, "rembg");
  assert.equal(result.extension, "png");
  assert.equal(result.contentType, "image/png");
  assert.equal(result.outputFormat, "png");
  assert.equal(result.sticker.width, 512);
  assert.equal(result.sticker.rembgAttempts, 1);
  const meta = await sharp(result.buffer).metadata();
  assert.equal(meta.hasAlpha, true);
});
