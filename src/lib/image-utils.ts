import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

// Load font once at module init — embedded in SVG as base64 to bypass fontconfig issues
let fontBase64Cache: string | null = null;
function getFontBase64(): string {
  if (fontBase64Cache) return fontBase64Cache;
  try {
    const fontPath = path.join(__dirname, "..", "assets", "Inter-Bold.otf");
    const fontBuffer = fs.readFileSync(fontPath);
    fontBase64Cache = fontBuffer.toString("base64");
    console.log("Embedded font loaded:", fontPath, "size:", fontBuffer.length);
  } catch (err: any) {
    console.warn("Failed to load embedded font:", err.message);
    fontBase64Cache = ""; // empty = will use fallback font
  }
  return fontBase64Cache;
}

/**
 * Morphological dilation of alpha channel.
 * Expands non-transparent pixels outward by `radius` pixels (circular kernel).
 */
function dilateAlpha(alpha: Buffer, w: number, h: number, radius: number): Buffer {
  const out = Buffer.alloc(w * h);
  const r2 = radius * radius;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let maxVal = 0;
      // Scan bounding box, check circular distance
      const yMin = Math.max(0, y - radius);
      const yMax = Math.min(h - 1, y + radius);
      const xMin = Math.max(0, x - radius);
      const xMax = Math.min(w - 1, x + radius);

      for (let ny = yMin; ny <= yMax; ny++) {
        const dy = ny - y;
        const dy2 = dy * dy;
        for (let nx = xMin; nx <= xMax; nx++) {
          const dx = nx - x;
          if (dx * dx + dy2 <= r2) {
            const val = alpha[ny * w + nx];
            if (val > maxVal) {
              maxVal = val;
              if (maxVal === 255) break; // Early exit — can't get higher
            }
          }
        }
        if (maxVal === 255) break;
      }
      out[y * w + x] = maxVal;
    }
  }
  return out;
}

/**
 * Add a white border/outline around the sticker by dilating the alpha channel.
 * The border is white (#FFFFFF), `borderWidth` pixels thick.
 * Returns a 512x512 WebP buffer ready for Telegram.
 *
 * Algorithm:
 * 1. Decode image to raw RGBA
 * 2. Extract alpha channel
 * 3. Dilate alpha (expand outward by borderWidth)
 * 4. Create white layer where dilated alpha > 0
 * 5. Composite: white border (bottom) + original (top)
 * 6. Resize to 512x512 + convert to WebP
 */
/**
 * Escape XML special characters for safe SVG embedding.
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Add text badge overlay to a sticker.
 * Renders a white rounded badge with black text on top of the sticker.
 * Font is embedded as base64 in SVG — no system fonts or fontconfig needed.
 * Returns a 512x512 WebP buffer ready for Telegram.
 *
 * @param inputBuffer - WebP/PNG sticker buffer
 * @param text - Text to overlay (truncated to 30 chars)
 * @param position - "top" or "bottom" (default: "bottom")
 */
export async function addTextToSticker(
  inputBuffer: Buffer,
  text: string,
  position: "top" | "bottom" = "bottom"
): Promise<Buffer> {
  // Truncate long text
  let displayText = text.trim();
  if (displayText.length > 30) {
    displayText = displayText.substring(0, 27) + "...";
  }

  // Auto-scale font size based on text length
  let fontSize: number;
  if (displayText.length <= 8) {
    fontSize = 36;
  } else if (displayText.length <= 15) {
    fontSize = 30;
  } else if (displayText.length <= 22) {
    fontSize = 26;
  } else {
    fontSize = 22;
  }

  // Calculate badge dimensions — width adapts to text length
  const STRIP_H = 52;
  const PADDING = 24;
  const charWidth = fontSize * 0.6;
  const textWidth = displayText.length * charWidth;
  const rectWidth = Math.min(500, Math.max(80, textWidth + PADDING * 2));
  const rectX = (512 - rectWidth) / 2;

  // Position: badge offset from edge
  const MARGIN = 6;
  const yRect = position === "bottom" ? 512 - STRIP_H - MARGIN : MARGIN;
  const yText = position === "bottom"
    ? 512 - STRIP_H / 2 - MARGIN + fontSize * 0.35
    : MARGIN + STRIP_H / 2 + fontSize * 0.35;

  // Build embedded font style (if available)
  const fontB64 = getFontBase64();
  const fontStyle = fontB64
    ? `<defs><style>@font-face { font-family: 'Inter'; src: url('data:font/otf;base64,${fontB64}') format('opentype'); }</style></defs>`
    : "";
  const fontFamily = fontB64 ? "Inter" : "DejaVu Sans, Arial, sans-serif";

  // Build SVG: white rounded badge + black text
  const svg = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  ${fontStyle}
  <rect x="${rectX}" y="${yRect}" width="${rectWidth}" height="${STRIP_H}"
        fill="white" opacity="0.92" rx="14" ry="14"/>
  <text x="256" y="${yText}" text-anchor="middle"
        font-family="${fontFamily}" font-size="${fontSize}" font-weight="bold"
        fill="#1a1a1a">${escapeXml(displayText)}</text>
</svg>`;

  const svgBuffer = Buffer.from(svg);
  console.log("addTextToSticker: text:", displayText, "fontSize:", fontSize,
    "badgeW:", rectWidth, "pos:", position, "fontEmbedded:", !!fontB64);

  // Composite SVG badge over the sticker
  const result = await sharp(inputBuffer)
    .ensureAlpha()
    .resize(512, 512, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .composite([{ input: svgBuffer, blend: "over" }])
    .webp()
    .toBuffer();

  return result;
}

export async function addWhiteBorder(inputBuffer: Buffer, borderWidth: number = 8): Promise<Buffer> {
  // Decode to raw RGBA
  const image = sharp(inputBuffer).ensureAlpha();
  const metadata = await image.metadata();
  const w = metadata.width!;
  const h = metadata.height!;

  const rawBuffer = await image.raw().toBuffer();

  // Extract alpha channel
  const alpha = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) {
    alpha[i] = rawBuffer[i * 4 + 3];
  }

  // Dilate alpha to create border mask
  const dilated = dilateAlpha(alpha, w, h, borderWidth);

  // Create white border layer (RGBA): white where dilated, transparent elsewhere
  const borderLayer = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    if (dilated[i] > 0) {
      borderLayer[i * 4] = 255;     // R
      borderLayer[i * 4 + 1] = 255; // G
      borderLayer[i * 4 + 2] = 255; // B
      borderLayer[i * 4 + 3] = dilated[i]; // A (use dilated alpha for smooth edges)
    }
    // else: all zeros (transparent) — already initialized by Buffer.alloc
  }

  // Composite: white border behind original image
  const composited = await sharp(borderLayer, { raw: { width: w, height: h, channels: 4 } })
    .composite([{
      input: rawBuffer,
      raw: { width: w, height: h, channels: 4 },
      blend: "over",
    }])
    .png()
    .toBuffer();

  // Trim, resize to 512x512, convert to WebP
  const result = await sharp(composited)
    .trim({ threshold: 2 })
    .resize(512, 512, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp()
    .toBuffer();

  return result;
}
