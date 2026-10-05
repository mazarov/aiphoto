/**
 * Free «Добавить текст» for a finished sticker — server-only (sharp + opentype.js).
 * Ported from the bot's `addTextToSticker`: text is turned into SVG glyph paths with opentype.js,
 * so the Alpine container needs no fontconfig / pango. Output: 512×512 PNG with alpha.
 */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import opentype from "opentype.js";
import { STICKER_OUTPUT_PX, normalizeStickerOverlayText } from "./sticker";

export type StickerTextPosition = "top" | "bottom";

const FONT_RELATIVE_PATH = path.join("public", "fonts", "Inter-Bold.otf");
const BADGE_H = 52;
const BADGE_MARGIN = 8;
const BADGE_PADDING = 24;
const BADGE_MIN_W = 80;
const BADGE_MAX_W = STICKER_OUTPUT_PX - 12;

let cachedFont: opentype.Font | null = null;

export function stickerTextFontPath(): string {
  return path.join(process.cwd(), FONT_RELATIVE_PATH);
}

function loadFont(): opentype.Font {
  if (cachedFont) return cachedFont;
  const file = fs.readFileSync(stickerTextFontPath());
  const arrayBuffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  cachedFont = opentype.parse(arrayBuffer);
  return cachedFont;
}

/** Same ladder as the bot: short captions large, long ones shrink to stay inside the badge. */
export function stickerTextFontSize(text: string): number {
  const length = text.length;
  if (length <= 8) return 36;
  if (length <= 15) return 30;
  if (length <= 22) return 26;
  return 22;
}

export type StickerTextBadgeLayout = {
  text: string;
  fontSize: number;
  textWidth: number;
  rectX: number;
  rectY: number;
  rectWidth: number;
  textX: number;
  baselineY: number;
};

export function layoutStickerTextBadge(input: {
  text: string;
  textWidth: number;
  fontSize: number;
  position: StickerTextPosition;
  canvasPx?: number;
}): StickerTextBadgeLayout {
  const canvas = input.canvasPx ?? STICKER_OUTPUT_PX;
  const textWidth = Math.ceil(input.textWidth);
  const rectWidth = Math.min(BADGE_MAX_W, Math.max(BADGE_MIN_W, textWidth + BADGE_PADDING * 2));
  const rectX = (canvas - rectWidth) / 2;
  const rectY = input.position === "bottom" ? canvas - BADGE_H - BADGE_MARGIN : BADGE_MARGIN;
  return {
    text: input.text,
    fontSize: input.fontSize,
    textWidth,
    rectX,
    rectY,
    rectWidth,
    textX: Math.round((canvas - textWidth) / 2),
    baselineY: Math.round(rectY + BADGE_H / 2 + input.fontSize * 0.35),
  };
}

export function stickerTextBadgeSvg(layout: StickerTextBadgeLayout, pathData: string, canvasPx = STICKER_OUTPUT_PX): string {
  return `<svg width="${canvasPx}" height="${canvasPx}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${layout.rectX}" y="${layout.rectY}" width="${layout.rectWidth}" height="${BADGE_H}" fill="white" opacity="0.92" rx="14" ry="14"/>
  <g fill="#1a1a1a">${pathData}</g>
</svg>`;
}

/**
 * Composite a white rounded badge with the caption onto the sticker.
 * Input: any PNG/WebP with alpha; output: 512×512 PNG (`fit: contain`, transparent padding).
 */
export async function addTextToStickerPng(
  input: Buffer,
  rawText: string,
  position: StickerTextPosition = "bottom",
): Promise<Buffer> {
  const text = normalizeStickerOverlayText(rawText);
  if (!text) throw new Error("sticker_text_empty");
  const font = loadFont();
  const fontSize = stickerTextFontSize(text);
  const layout = layoutStickerTextBadge({
    text,
    textWidth: font.getAdvanceWidth(text, fontSize),
    fontSize,
    position,
  });
  const glyphPath = font.getPath(text, layout.textX, layout.baselineY, fontSize);
  const pathData = glyphPath.toSVG(2);
  const svg = stickerTextBadgeSvg(layout, pathData);
  return sharp(input)
    .ensureAlpha()
    .resize(STICKER_OUTPUT_PX, STICKER_OUTPUT_PX, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .composite([{ input: Buffer.from(svg), blend: "over" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}
