/**
 * Server-only: convert a finished sticker PNG (512×512, alpha) into the exact file a messenger accepts.
 * Pure sharp, no `@/` imports besides types — unit-tested without Next.
 */

import sharp from "sharp";
import { STICKER_ALPHA_HARD_MIN, type StickerPlatform } from "./sticker";

export type StickerExportOptions = {
  /** Row is a «Обводка» result: snap the white ring. Plain stickers keep their soft edge. */
  hasBorder?: boolean;
};

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

/**
 * Border rows saved before the ring was snapped carry a white gradient edge. Snap only near-white
 * pixels: below `STICKER_ALPHA_HARD_MIN` they disappear, the rest becomes a hard edge. Coloured
 * pixels (hair, skin, teeth) stay untouched. Not applied to plain stickers — their soft edge is intended.
 */
export async function crispStickerFringe(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input, { failOn: "none" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.from(data);
  const pixels = info.width * info.height;
  for (let i = 0; i < pixels; i += 1) {
    const offset = i * 4;
    const red = rgba[offset];
    const green = rgba[offset + 1];
    const blue = rgba[offset + 2];
    if (red < 235 || green < 235 || blue < 235) continue;
    if (rgba[offset + 3] >= STICKER_ALPHA_HARD_MIN) rgba[offset + 3] = 255;
    else {
      rgba[offset] = 0;
      rgba[offset + 1] = 0;
      rgba[offset + 2] = 0;
      rgba[offset + 3] = 0;
    }
  }
  return sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

/** Square `sidePx` canvas with alpha; the source is already 512 with a safe margin, this only guards odd inputs. */
function normalizeCanvas(input: Buffer, sidePx: number) {
  return sharp(input, { failOn: "none" })
    .ensureAlpha()
    .resize(sidePx, sidePx, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
}

export async function exportStickerForPlatform(
  input: Buffer,
  platform: StickerPlatform,
  options?: StickerExportOptions,
): Promise<StickerExportResult> {
  const crisp = options?.hasBorder ? await crispStickerFringe(input) : input;
  const side = platform.sidePx;
  if (platform.format === "png") {
    let buffer = await normalizeCanvas(crisp, side).png({ compressionLevel: 9, palette: false }).toBuffer();
    if (buffer.length > platform.maxBytes) {
      buffer = await normalizeCanvas(crisp, side).png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer();
    }
    return { buffer, contentType: "image/png", quality: null, width: side, height: side };
  }
  // WebP: try lossless first (crisp line art), then the lossy ladder until under the limit.
  const lossless = await normalizeCanvas(crisp, side).webp({ lossless: true, effort: 4 }).toBuffer();
  if (lossless.length <= platform.maxBytes) {
    return { buffer: lossless, contentType: "image/webp", quality: null, width: side, height: side };
  }
  let last: { buffer: Buffer; quality: number } | null = null;
  for (const quality of WEBP_QUALITY_LADDER) {
    const buffer = await normalizeCanvas(crisp, side).webp({ quality, alphaQuality: 90, effort: 4 }).toBuffer();
    last = { buffer, quality };
    if (buffer.length <= platform.maxBytes) break;
  }
  if (!last) throw new Error("sticker export produced no output");
  return { buffer: last.buffer, contentType: "image/webp", quality: last.quality, width: side, height: side };
}
