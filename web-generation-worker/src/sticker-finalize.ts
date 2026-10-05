import sharp from "sharp";
import {
  STICKER_BACKGROUND_HEX,
  STICKER_OUTLINE_PX,
  STICKER_OUTPUT_PX,
} from "../../landing/src/lib/sticker";
import { ProcessingError } from "./input-source";
import type { EncodedGenerationResult } from "./result-encode";

/** rembg gets at most this on the long side — same as the bot; keeps latency bounded. */
const REMBG_INPUT_MAX_PX = 1024;
const REMBG_TIMEOUT_MS = 90_000;
const REMBG_ATTEMPTS = 2;

export type StickerFinalizeStats = {
  rembgMs: number;
  rembgAttempts: number;
  chromaPixelsCleared: number;
  outlineMs: number;
  width: number;
  height: number;
};

export type StickerFinalizeOptions = {
  rembgUrl: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  /** Override for tests; production uses STICKER_OUTLINE_PX. */
  outlinePx?: number;
  outputPx?: number;
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
 * Cut-out PNG → white die-cut border → trim → square `outputPx` canvas with transparent padding.
 */
export async function composeStickerFromCutout(
  cutout: Buffer,
  options?: { outlinePx?: number; outputPx?: number },
): Promise<{ buffer: Buffer; width: number; height: number; outlineMs: number; chromaPixelsCleared: number }> {
  const outputPx = options?.outputPx ?? STICKER_OUTPUT_PX;
  const outlinePx = options?.outlinePx ?? STICKER_OUTLINE_PX;
  const started = Date.now();

  // Work at output scale (+ margin for the border) so the outline width is predictable.
  const workPx = outputPx * 2;
  const trimmed = await sharp(cutout, { failOn: "none" })
    .ensureAlpha()
    .trim({ threshold: 1 })
    .toBuffer()
    .catch(() => cutout);
  const inner = Math.max(16, workPx - outlinePx * 4);
  const { data, info } = await sharp(trimmed, { failOn: "none" })
    .ensureAlpha()
    .resize(inner, inner, { fit: "inside", withoutEnlargement: false, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: outlinePx * 2,
      bottom: outlinePx * 2,
      left: outlinePx * 2,
      right: outlinePx * 2,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const rgba = Buffer.from(data);
  const chromaPixelsCleared = clearChromaFringe(rgba, width, height);

  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) alpha[i] = rgba[i * 4 + 3];
  // Border radius scaled to the working canvas (2× output).
  const dilated = dilateAlpha(alpha, width, height, outlinePx * 2);
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
  const composited = await sharp(border, { raw: { width, height, channels: 4 } })
    .composite([{ input: rgba, raw: { width, height, channels: 4 }, blend: "over" }])
    .png()
    .toBuffer();

  const buffer = await sharp(composited)
    .trim({ threshold: 1 })
    .resize(outputPx, outputPx, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
  return { buffer, width: outputPx, height: outputPx, outlineMs: Date.now() - started, chromaPixelsCleared };
}

export async function finalizeStickerImage(
  input: Buffer,
  options: StickerFinalizeOptions,
): Promise<EncodedGenerationResult & { sticker: StickerFinalizeStats }> {
  const bytesIn = input.length;
  const started = Date.now();
  const rembg = await removeBackgroundViaRembg(input, options);
  const composed = await composeStickerFromCutout(rembg.buffer, {
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
      rembgMs: rembg.ms,
      rembgAttempts: rembg.attempts,
      chromaPixelsCleared: composed.chromaPixelsCleared,
      outlineMs: composed.outlineMs,
      width: composed.width,
      height: composed.height,
    },
  };
}
