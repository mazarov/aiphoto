/**
 * Server-only: convert a finished sticker PNG (512×512, alpha) into the exact file a messenger accepts.
 * Pure sharp, no `@/` imports besides types — unit-tested without Next.
 */

import sharp from "sharp";
import type { StickerPlatform } from "./sticker";

export type StickerExportResult = {
  buffer: Buffer;
  contentType: "image/webp" | "image/png";
  /** WebP quality that met the byte limit, or null for PNG / lossless. */
  quality: number | null;
  width: number;
  height: number;
};

/** WebP quality ladder: start near-lossless, step down until the platform limit is met. */
const WEBP_QUALITY_LADDER = [95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40] as const;

/** Square `sidePx` canvas with alpha; the source is already 512 with a safe margin, this only guards odd inputs. */
function normalizeCanvas(input: Buffer, sidePx: number) {
  return sharp(input, { failOn: "none" })
    .ensureAlpha()
    .resize(sidePx, sidePx, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
}

export async function exportStickerForPlatform(input: Buffer, platform: StickerPlatform): Promise<StickerExportResult> {
  const side = platform.sidePx;
  if (platform.format === "png") {
    let buffer = await normalizeCanvas(input, side).png({ compressionLevel: 9, palette: false }).toBuffer();
    if (buffer.length > platform.maxBytes) {
      buffer = await normalizeCanvas(input, side).png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer();
    }
    return { buffer, contentType: "image/png", quality: null, width: side, height: side };
  }
  // WebP: try lossless first (crisp line art), then the lossy ladder until under the limit.
  const lossless = await normalizeCanvas(input, side).webp({ lossless: true, effort: 4 }).toBuffer();
  if (lossless.length <= platform.maxBytes) {
    return { buffer: lossless, contentType: "image/webp", quality: null, width: side, height: side };
  }
  let last: { buffer: Buffer; quality: number } | null = null;
  for (const quality of WEBP_QUALITY_LADDER) {
    const buffer = await normalizeCanvas(input, side).webp({ quality, alphaQuality: 90, effort: 4 }).toBuffer();
    last = { buffer, quality };
    if (buffer.length <= platform.maxBytes) break;
  }
  if (!last) throw new Error("sticker export produced no output");
  return { buffer: last.buffer, contentType: "image/webp", quality: last.quality, width: side, height: side };
}
