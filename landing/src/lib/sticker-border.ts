/**
 * Free «Обводка» for a finished sticker. Same idea as the bot's `addWhiteBorder`:
 * dilate the alpha and lay white behind the figure. Alpha is snapped to a hard edge
 * first, so a soft hem does not smear the ring. The canvas is not resized —
 * a second scale is what blurred the ring when the outline was baked into generation.
 */

import sharp from "sharp";
import { STICKER_ALPHA_HARD_MIN, STICKER_BORDER_PX, STICKER_OUTPUT_PX, clampStickerBorderPx } from "./sticker";

function dilateAlpha(alpha: Uint8Array, width: number, height: number, radius: number): Uint8Array {
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

export async function addWhiteBorderToStickerPng(
  input: Buffer,
  borderPx: number = STICKER_BORDER_PX,
): Promise<Buffer> {
  const radius = clampStickerBorderPx(borderPx);
  const { data, info } = await sharp(input, { failOn: "none" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const rgba = Buffer.from(data);
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    if (rgba[offset + 3] >= STICKER_ALPHA_HARD_MIN) {
      rgba[offset + 3] = 255;
      alpha[i] = 255;
      continue;
    }
    rgba[offset] = 0;
    rgba[offset + 1] = 0;
    rgba[offset + 2] = 0;
    rgba[offset + 3] = 0;
    alpha[i] = 0;
  }
  const dilated = dilateAlpha(alpha, width, height, radius);
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
  let pipeline = sharp(border, { raw: { width, height, channels: 4 } }).composite([
    { input: rgba, raw: { width, height, channels: 4 }, blend: "over" },
  ]);
  if (width !== STICKER_OUTPUT_PX || height !== STICKER_OUTPUT_PX) {
    pipeline = pipeline.resize(STICKER_OUTPUT_PX, STICKER_OUTPUT_PX, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }
  return pipeline.png({ compressionLevel: 9, palette: false }).toBuffer();
}
