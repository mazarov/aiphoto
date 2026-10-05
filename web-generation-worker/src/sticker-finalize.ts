import sharp from "sharp";
import {
  DEFAULT_STICKER_BG_ROUTE,
  STICKER_BACKGROUND_HEX,
  STICKER_OUTPUT_PX,
  STICKER_SAFE_MARGIN_PX,
  type StickerBgRoute,
} from "../../landing/src/lib/sticker";
import { ProcessingError } from "./input-source";
import type { EncodedGenerationResult } from "./result-encode";

/** rembg gets at most this on the long side — same as the bot; keeps latency bounded. */
const REMBG_INPUT_MAX_PX = 1024;
const REMBG_TIMEOUT_MS = 90_000;
const REMBG_ATTEMPTS = 2;
/** Frame is treated as "model painted the magenta background" above this share of key pixels. */
export const STICKER_CHROMA_ONLY_RATIO = 0.2;
/** Between this and CHROMA_ONLY: key first, then rembg tidies what the model drew behind the figure. */
export const STICKER_CHROMA_ASSIST_RATIO = 0.05;

/** Which pass actually removed the background. `alpha_native` — provider returned real transparency (GPT Image). */
export type StickerBgRouteUsed = "alpha_native" | "chroma" | "chroma_rembg" | "rembg" | "rembg_forced";
/** Share of (near-)fully transparent pixels that proves the provider frame already carries alpha. */
export const STICKER_ALPHA_NATIVE_RATIO = 0.05;

export type StickerFinalizeStats = {
  /** 0 when rembg did not run. */
  rembgMs: number;
  rembgAttempts: number;
  chromaPixelsCleared: number;
  outlineMs: number;
  width: number;
  height: number;
  magentaRatio: number;
  route: StickerBgRouteUsed;
  /** Pixels keyed out by the chroma pass (0 on the rembg-only route). */
  chromaKeyedPixels: number;
};

export type StickerFinalizeOptions = {
  rembgUrl: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  /** White die-cut width. Production passes nothing: the sticker is saved without an outline. */
  outlinePx?: number;
  outputPx?: number;
  /** Routing flag from `landing_generation_config.sticker_bg_route`; default chroma_first. */
  bgRoute?: StickerBgRoute;
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
}

const BG = hexToRgb(STICKER_BACKGROUND_HEX);

/**
 * Emotion / motion edits start from the finished transparent PNG. The model is told the subject sits on
 * flat magenta, so flatten alpha onto that colour first — otherwise providers fill transparency with
 * black / white / checker and the edit prompt and chroma cleanup disagree with what the model saw.
 */
export async function flattenStickerSourceForEdit(input: Buffer): Promise<{ buffer: Buffer; mimeType: string }> {
  const buffer = await sharp(input)
    .ensureAlpha()
    .flatten({ background: { r: BG.r, g: BG.g, b: BG.b } })
    .png({ compressionLevel: 6 })
    .toBuffer();
  return { buffer, mimeType: "image/png" };
}

/** Share of pixels close to the chroma key — decides between keying and segmentation. */
export function magentaRatio(rgba: Buffer, width: number, height: number, tolerance = 90): number {
  const total = width * height;
  if (!total) return 0;
  let hits = 0;
  for (let i = 0; i < total; i += 1) {
    const o = i * 4;
    const dist = Math.abs(rgba[o] - BG.r) + Math.abs(rgba[o + 1] - BG.g) + Math.abs(rgba[o + 2] - BG.b);
    if (dist <= tolerance) hits += 1;
  }
  return hits / total;
}

/**
 * Key out the flat magenta the model painted. Hard radius → fully transparent; soft radius →
 * alpha ramps down so anti-aliased edges stay smooth. Operates in place on RGBA.
 * Pink / purple on the subject is far from #FF00FF in RGB (green channel), so a tight radius keeps it.
 */
export function chromaKeyMagenta(
  rgba: Buffer,
  width: number,
  height: number,
  options?: { hard?: number; soft?: number; despillBandPx?: number },
): number {
  const hard = options?.hard ?? 70;
  const soft = options?.soft ?? 130;
  const bandPx = options?.despillBandPx ?? 3;
  const hardSq = hard * hard;
  const softSq = soft * soft;
  const total = width * height;
  let keyed = 0;
  // Pass 1: distance key. `cleared` marks pixels that became fully transparent — seed of the edge band.
  const cleared = new Uint8Array(total);
  for (let i = 0; i < total; i += 1) {
    const o = i * 4;
    const dr = rgba[o] - BG.r;
    const dg = rgba[o + 1] - BG.g;
    const db = rgba[o + 2] - BG.b;
    const distSq = dr * dr + dg * dg + db * db;
    if (distSq <= hardSq) {
      rgba[o + 3] = 0;
      cleared[i] = 255;
      keyed += 1;
    } else if (distSq < softSq) {
      const t = (distSq - hardSq) / (softSq - hardSq);
      rgba[o + 3] = Math.round(rgba[o + 3] * t);
      keyed += 1;
    }
  }
  if (bandPx <= 0) return keyed;
  // Pass 2: colour-difference despill only within `bandPx` of a keyed pixel. Anti-aliased edges are a
  // mix of figure and #FF00FF: the magenta excess (min(r,b) − g) becomes transparency and the tint is
  // neutralised. Pink inside the figure is outside the band and stays.
  const band = dilateAlpha(cleared, width, height, bandPx);
  for (let i = 0; i < total; i += 1) {
    if (!band[i] || cleared[i]) continue;
    const o = i * 4;
    const a = rgba[o + 3];
    if (a === 0) continue;
    const r = rgba[o];
    const g = rgba[o + 1];
    const b = rgba[o + 2];
    const spill = Math.min(r, b) - g;
    if (spill <= 24) continue;
    const factor = Math.max(0, 1 - spill / 160);
    rgba[o] = r - spill;
    rgba[o + 2] = b - spill;
    rgba[o + 3] = Math.round(a * factor);
    keyed += 1;
  }
  return keyed;
}

/** Decode the provider frame (≤ 1024 px) to RGBA once; shared by the ratio check and the key pass. */
async function decodeFrameRgba(input: Buffer): Promise<{ rgba: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(input, { failOn: "none" })
    .rotate()
    .resize(REMBG_INPUT_MAX_PX, REMBG_INPUT_MAX_PX, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { rgba: Buffer.from(data), width: info.width, height: info.height };
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

/**
 * POST the frame to rembg. Network / 5xx → retryable ProcessingError so the queue
 * re-runs the whole attempt (provider output is cheap to redo compared to a lost job).
 */
export async function removeBackgroundViaRembg(
  input: Buffer,
  options: StickerFinalizeOptions,
): Promise<{ buffer: Buffer; ms: number; attempts: number }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = options.rembgUrl.replace(/\/+$/, "");
  if (!base) {
    throw new ProcessingError("config_error", "REMBG_URL is not configured", false);
  }
  const prepared = await sharp(input, { failOn: "none" })
    .rotate()
    .resize(REMBG_INPUT_MAX_PX, REMBG_INPUT_MAX_PX, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();

  const started = Date.now();
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= REMBG_ATTEMPTS; attempt += 1) {
    if (options.signal?.aborted) {
      throw new ProcessingError("shutdown", "worker shutting down", true);
    }
    const form = new FormData();
    form.append("image", new Blob([new Uint8Array(prepared)], { type: "image/png" }), "image.png");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REMBG_TIMEOUT_MS);
    const onAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onAbort, { once: true });
    try {
      const response = await fetchImpl(`${base}/remove-background`, {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        lastError = new Error(`rembg ${response.status}: ${text.slice(0, 200)}`);
        if (response.status >= 400 && response.status < 500) {
          throw new ProcessingError("sticker_background_error", String(lastError), false);
        }
      } else {
        const out = Buffer.from(await response.arrayBuffer());
        if (out.length < 100) {
          lastError = new Error("rembg returned an empty body");
        } else {
          return { buffer: out, ms: Date.now() - started, attempts: attempt };
        }
      }
    } catch (error) {
      if (error instanceof ProcessingError) throw error;
      lastError = error;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
    }
    if (attempt < REMBG_ATTEMPTS) await sleep(2000 * attempt, options.signal);
  }
  throw new ProcessingError(
    "sticker_background_error",
    lastError instanceof Error ? lastError.message : String(lastError),
    true,
  );
}

/**
 * rembg leaves a thin magenta fringe where the model blended subject into background.
 * Clear pixels that are still close to the chroma key and desaturate the halo.
 */
export function clearChromaFringe(
  rgba: Buffer,
  width: number,
  height: number,
  tolerance = 70,
): number {
  let cleared = 0;
  const total = width * height;
  for (let i = 0; i < total; i += 1) {
    const o = i * 4;
    const a = rgba[o + 3];
    if (a === 0) continue;
    const r = rgba[o];
    const g = rgba[o + 1];
    const b = rgba[o + 2];
    const dist = Math.abs(r - BG.r) + Math.abs(g - BG.g) + Math.abs(b - BG.b);
    if (dist <= tolerance) {
      rgba[o + 3] = 0;
      cleared += 1;
      continue;
    }
    // Soft halo: magenta-ish semi-transparent edge → pull towards neutral.
    if (a < 255 && r > g + 40 && b > g + 40) {
      const avg = Math.round((r + g + b) / 3);
      rgba[o] = Math.round((r + avg) / 2);
      rgba[o + 1] = Math.round((g + avg) / 2);
      rgba[o + 2] = Math.round((b + avg) / 2);
    }
  }
  return cleared;
}

/**
 * Soft alpha is what makes the die-cut look smeared: dilation takes the max of a gradient and the
 * later downscale blurs it again. Anything below half goes fully transparent (this also drops the
 * faint checkerboard squares GPT Image leaves around the figure); the rest becomes a hard edge.
 */
export const STICKER_ALPHA_HARD_MIN = 128;

export function hardenAlpha(rgba: Buffer, width: number, height: number, min = STICKER_ALPHA_HARD_MIN): void {
  const pixels = width * height;
  for (let i = 0; i < pixels; i += 1) {
    const offset = i * 4;
    if (rgba[offset + 3] >= min) {
      rgba[offset + 3] = 255;
      continue;
    }
    rgba[offset] = 0;
    rgba[offset + 1] = 0;
    rgba[offset + 2] = 0;
    rgba[offset + 3] = 0;
  }
}

/** Max-filter on the alpha channel: every opaque pixel grows by `radius`. */
export function dilateAlpha(alpha: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius <= 0) return Uint8Array.from(alpha);
  // Two-pass separable dilation (horizontal, then vertical) — O(w*h*r) instead of r².
  const horizontal = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      let max = 0;
      const from = Math.max(0, x - radius);
      const to = Math.min(width - 1, x + radius);
      for (let k = from; k <= to; k += 1) {
        const v = alpha[row + k];
        if (v > max) {
          max = v;
          if (max === 255) break;
        }
      }
      horizontal[row + x] = max;
    }
  }
  const out = new Uint8Array(width * height);
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      let max = 0;
      const from = Math.max(0, y - radius);
      const to = Math.min(height - 1, y + radius);
      for (let k = from; k <= to; k += 1) {
        const v = horizontal[k * width + x];
        if (v > max) {
          max = v;
          if (max === 255) break;
        }
      }
      out[y * width + x] = max;
    }
  }
  return out;
}

/**
 * Cut-out PNG → square `outputPx` canvas with a transparent safe margin
 * on every side (the figure never touches the canvas edge — the bot's 15 px, WhatsApp's 16 px).
 * No white outline unless `outlinePx` is set; the result button paints that later.
 */
export async function composeStickerFromCutout(
  cutout: Buffer,
  options?: { outlinePx?: number; outputPx?: number; marginPx?: number },
): Promise<{ buffer: Buffer; width: number; height: number; outlineMs: number; chromaPixelsCleared: number }> {
  const outputPx = options?.outputPx ?? STICKER_OUTPUT_PX;
  const outlinePx = Math.max(0, options?.outlinePx ?? 0);
  const marginPx = Math.max(0, Math.min(Math.floor(outputPx / 4), options?.marginPx ?? STICKER_SAFE_MARGIN_PX));
  const started = Date.now();

  // Fit the figure at the final size first, then paint the border. A resize after dilation
  // (the old 2× canvas) is what blurred the white ring.
  const contentPx = outputPx - marginPx * 2;
  const figurePx = Math.max(16, contentPx - outlinePx * 2);
  const trimmed = await sharp(cutout, { failOn: "none" })
    .ensureAlpha()
    .trim({ threshold: 1 })
    .toBuffer()
    .catch(() => cutout);
  const { data, info } = await sharp(trimmed, { failOn: "none" })
    .ensureAlpha()
    .resize(figurePx, figurePx, { fit: "inside", withoutEnlargement: false, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: outlinePx,
      bottom: outlinePx,
      left: outlinePx,
      right: outlinePx,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const rgba = Buffer.from(data);
  const chromaPixelsCleared = clearChromaFringe(rgba, width, height);
  hardenAlpha(rgba, width, height);

  let composited: Buffer;
  if (outlinePx > 0) {
    const alpha = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i += 1) alpha[i] = rgba[i * 4 + 3];
    const dilated = dilateAlpha(alpha, width, height, outlinePx);
    const border = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i += 1) {
      const a = dilated[i];
      if (!a) continue;
      const o = i * 4;
      border[o] = 255;
      border[o + 1] = 255;
      border[o + 2] = 255;
      border[o + 3] = a;
    }
    composited = await sharp(border, { raw: { width, height, channels: 4 } })
      .composite([{ input: rgba, raw: { width, height, channels: 4 }, blend: "over" }])
      .png()
      .toBuffer();
  } else {
    composited = await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
  }

  const padX = Math.max(0, contentPx - width);
  const padY = Math.max(0, contentPx - height);
  const buffer = await sharp(composited)
    .extend({
      top: Math.floor(padY / 2) + marginPx,
      bottom: padY - Math.floor(padY / 2) + marginPx,
      left: Math.floor(padX / 2) + marginPx,
      right: padX - Math.floor(padX / 2) + marginPx,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
  return { buffer, width: outputPx, height: outputPx, outlineMs: Date.now() - started, chromaPixelsCleared };
}

/** Fraction of pixels with alpha ≤ 8 — real transparency from the provider, not a painted checkerboard. */
export function transparentRatio(rgba: Buffer, width: number, height: number): number {
  const total = width * height;
  if (!total) return 0;
  let clear = 0;
  for (let i = 3; i < total * 4; i += 4) {
    if (rgba[i] <= 8) clear += 1;
  }
  return clear / total;
}

/**
 * Pick the background pass from the share of key-coloured pixels in the provider frame.
 * Pure function so the thresholds are unit-testable. A frame with real alpha wins regardless of the flag.
 */
export function pickStickerBgRoute(ratio: number, flag: StickerBgRoute, alphaRatio = 0): StickerBgRouteUsed {
  if (alphaRatio >= STICKER_ALPHA_NATIVE_RATIO) return "alpha_native";
  if (flag === "rembg") return "rembg_forced";
  if (ratio >= STICKER_CHROMA_ONLY_RATIO) return "chroma";
  if (ratio >= STICKER_CHROMA_ASSIST_RATIO) return "chroma_rembg";
  return "rembg";
}

/**
 * Background removal with routing:
 *  - `chroma`        — flat magenta frame: key it out, no segmentation model (nothing gets cropped by saliency).
 *  - `chroma_rembg`  — partial magenta: key first, then rembg cleans whatever the model drew behind the figure.
 *  - `rembg`         — model ignored the key colour: segmentation as before.
 * Any failure of the key pass falls through to rembg; rembg failure after a key pass keeps the keyed result.
 */
export async function removeStickerBackground(
  input: Buffer,
  options: StickerFinalizeOptions,
): Promise<{
  buffer: Buffer;
  route: StickerBgRouteUsed;
  magentaRatio: number;
  chromaKeyedPixels: number;
  rembgMs: number;
  rembgAttempts: number;
}> {
  const flag = options.bgRoute ?? DEFAULT_STICKER_BG_ROUTE;
  let ratio = 0;
  let alphaRatio = 0;
  let frame: { rgba: Buffer; width: number; height: number } | null = null;
  try {
    frame = await decodeFrameRgba(input);
    alphaRatio = transparentRatio(frame.rgba, frame.width, frame.height);
    ratio = alphaRatio >= STICKER_ALPHA_NATIVE_RATIO ? 0 : magentaRatio(frame.rgba, frame.width, frame.height);
  } catch {
    frame = null;
  }
  const route = frame ? pickStickerBgRoute(ratio, flag, alphaRatio) : flag === "rembg" ? "rembg_forced" : "rembg";

  if (route === "alpha_native" && frame) {
    // Provider already isolated the subject (GPT Image `background: "transparent"`): nothing to key, nothing to segment.
    const png = await sharp(frame.rgba, { raw: { width: frame.width, height: frame.height, channels: 4 } })
      .png({ compressionLevel: 3 })
      .toBuffer();
    return { buffer: png, route, magentaRatio: 0, chromaKeyedPixels: 0, rembgMs: 0, rembgAttempts: 0 };
  }

  if (route === "rembg" || route === "rembg_forced" || !frame) {
    const rembg = await removeBackgroundViaRembg(input, options);
    return { buffer: rembg.buffer, route, magentaRatio: ratio, chromaKeyedPixels: 0, rembgMs: rembg.ms, rembgAttempts: rembg.attempts };
  }

  const keyed = chromaKeyMagenta(frame.rgba, frame.width, frame.height);
  const keyedPng = await sharp(frame.rgba, { raw: { width: frame.width, height: frame.height, channels: 4 } })
    .png({ compressionLevel: 3 })
    .toBuffer();
  if (route === "chroma") {
    return { buffer: keyedPng, route, magentaRatio: ratio, chromaKeyedPixels: keyed, rembgMs: 0, rembgAttempts: 0 };
  }
  try {
    const rembg = await removeBackgroundViaRembg(keyedPng, options);
    return { buffer: rembg.buffer, route, magentaRatio: ratio, chromaKeyedPixels: keyed, rembgMs: rembg.ms, rembgAttempts: rembg.attempts };
  } catch (error) {
    if (error instanceof ProcessingError && error.errorType === "shutdown") throw error;
    return { buffer: keyedPng, route: "chroma", magentaRatio: ratio, chromaKeyedPixels: keyed, rembgMs: 0, rembgAttempts: REMBG_ATTEMPTS };
  }
}

/**
 * One sticker-pack cell from GPT Image (`background: transparent`).
 * The provider already returned alpha, so this never calls chroma key or rembg.
 * An opaque cell is a bad sheet: retry the job instead of segmenting it.
 */
export async function finalizeStickerPackCell(
  input: Buffer,
  options?: { signal?: AbortSignal; outputPx?: number },
): Promise<EncodedGenerationResult & { sticker: StickerFinalizeStats }> {
  if (options?.signal?.aborted) {
    throw new ProcessingError("shutdown", "Sticker pack finalize aborted", false);
  }
  const bytesIn = input.length;
  const started = Date.now();
  const frame = await decodeFrameRgba(input);
  const alphaRatio = transparentRatio(frame.rgba, frame.width, frame.height);
  if (alphaRatio < STICKER_ALPHA_NATIVE_RATIO) {
    throw new ProcessingError(
      "provider_error",
      "Sticker pack cell has no transparent background",
      true,
    );
  }
  const png = await sharp(frame.rgba, { raw: { width: frame.width, height: frame.height, channels: 4 } })
    .png({ compressionLevel: 3 })
    .toBuffer();
  const composed = await composeStickerFromCutout(png, { outputPx: options?.outputPx });
  return {
    buffer: composed.buffer,
    extension: "png",
    contentType: "image/png",
    bytesIn,
    bytesOut: composed.buffer.length,
    outputFormat: "png",
    encodeMs: Date.now() - started,
    skippedReason: null,
    sticker: {
      rembgMs: 0,
      rembgAttempts: 0,
      chromaPixelsCleared: composed.chromaPixelsCleared,
      outlineMs: composed.outlineMs,
      width: composed.width,
      height: composed.height,
      magentaRatio: 0,
      route: "alpha_native",
      chromaKeyedPixels: 0,
    },
  };
}

export async function finalizeStickerImage(
  input: Buffer,
  options: StickerFinalizeOptions,
): Promise<EncodedGenerationResult & { sticker: StickerFinalizeStats }> {
  const bytesIn = input.length;
  const started = Date.now();
  const removed = await removeStickerBackground(input, options);
  const composed = await composeStickerFromCutout(removed.buffer, {
    outlinePx: options.outlinePx,
    outputPx: options.outputPx,
  });
  return {
    buffer: composed.buffer,
    extension: "png",
    contentType: "image/png",
    bytesIn,
    bytesOut: composed.buffer.length,
    outputFormat: "png",
    encodeMs: Date.now() - started,
    skippedReason: null,
    sticker: {
      rembgMs: removed.rembgMs,
      rembgAttempts: removed.rembgAttempts,
      chromaPixelsCleared: composed.chromaPixelsCleared,
      outlineMs: composed.outlineMs,
      width: composed.width,
      height: composed.height,
      magentaRatio: Math.round(removed.magentaRatio * 1000) / 1000,
      route: removed.route,
      chromaKeyedPixels: removed.chromaKeyedPixels,
    },
  };
}
