import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  analyzeImageSettings,
  parseAnalyzeImageBuffer,
  unwrapAnalyzeScreenshotImage,
} from "./image-prompt-analyze-image";

async function makeParsedPng(
  width: number,
  height: number,
  paintPixel: (x: number, y: number) => [number, number, number],
) {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = paintPixel(x, y);
      const offset = (y * width + x) * 3;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
    }
  }
  const png = await sharp(raw, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
  const parsed = parseAnalyzeImageBuffer(png);
  assert.ok(parsed, "expected valid parsed image");
  return parsed;
}

test("crops solid TikTok-style top status bar and bottom caption/nav block while keeping inner 3-panel collage", async () => {
  const width = 390;
  const height = 844; // ~9:19.5 iPhone viewport (aspect ~0.462)
  const topBarEnd = 36;
  const bottomBarStart = 610;

  const image = await makeParsedPng(width, height, (x, y) => {
    // Top black status bar with white clock/battery glyph blocks
    if (y < topBarEnd) {
      if (y >= 12 && y <= 22 && ((x >= 26 && x <= 62) || (x >= 330 && x <= 364))) {
        return [245, 245, 245];
      }
      return [0, 0, 0];
    }
    // Bottom black TikTok caption + tab bar with white text/icon glyphs and thin divider
    if (y >= bottomBarStart) {
      if (y === 760) return [38, 38, 38]; // subtle separator above bottom nav
      if (
        (y >= 635 && y <= 648 && x >= 24 && x <= 190 && x % 4 === 0) ||
        (y >= 660 && y <= 672 && x >= 24 && x <= 230 && x % 4 === 0) ||
        (y >= 785 && y <= 808 && x % 75 >= 30 && x % 75 <= 44 && (x + y) % 2 === 0)
      ) {
        return [242, 242, 242];
      }
      return [5, 5, 5];
    }
    // Inner 3-panel bright flash portrait collage (white wall + warm subject + dark hoodie)
    const panelH = Math.floor((bottomBarStart - topBarEnd) / 3);
    const localY = (y - topBarEnd) % panelH;
    // Thin 2px seam between collage panels
    if (y > topBarEnd + 4 && localY < 2) {
      return [25, 25, 25];
    }
    const cx = width * 0.52;
    const dx = Math.abs(x - cx);
    // Hoodie shoulders/chest at bottom of each panel
    if (localY > panelH * 0.68 && dx < width * 0.36) {
      return [28, 30, 34];
    }
    // Warm skin/ginger hair center
    if (dx < width * 0.22 && localY > panelH * 0.08) {
      return [212, 158, 128];
    }
    // Direct-flash lit wall with cast shadow on left
    if (x > width * 0.16 && x < width * 0.32 && localY > panelH * 0.2) {
      return [95, 92, 90];
    }
    return [232, 230, 226];
  });

  const result = await unwrapAnalyzeScreenshotImage(image);
  assert.equal(result.screenshotCropped, true);
  assert.equal(result.originalHeight, height);
  assert.ok(result.croppedHeight, "croppedHeight should be reported");

  // Expected inner height is 610 - 36 = 574px (allow small scanline scaling tolerance)
  assert.ok(
    Math.abs((result.croppedHeight ?? 0) - (bottomBarStart - topBarEnd)) <= 18,
    `expected croppedHeight near ${bottomBarStart - topBarEnd}, got ${result.croppedHeight}`,
  );

  const beforeSettings = await analyzeImageSettings(image.data);
  const afterSettings = await analyzeImageSettings(result.image.data);
  assert.equal(beforeSettings?.aspectRatio, "9:16");
  // 390 / 574 ≈ 0.679 → closer to 3:4 / 4:7 than phone 9:16
  assert.notEqual(afterSettings?.aspectRatio, "9:16");
});

test("does not crop standard 3:4 portrait or 1:1 square images even with dark borders", async () => {
  const portrait34 = await makeParsedPng(600, 800, (_x, y) =>
    y < 80 || y > 700 ? [0, 0, 0] : [210, 180, 160],
  );
  const square = await makeParsedPng(600, 600, (_x, y) =>
    y < 80 || y > 500 ? [0, 0, 0] : [210, 180, 160],
  );

  const res34 = await unwrapAnalyzeScreenshotImage(portrait34);
  const res11 = await unwrapAnalyzeScreenshotImage(square);

  assert.equal(res34.screenshotCropped, false);
  assert.equal(res34.image, portrait34);
  assert.equal(res11.screenshotCropped, false);
  assert.equal(res11.image, square);
});

test("does not crop a 9:16 low-key studio portrait with dark background and vignette", async () => {
  const width = 450;
  const height = 800; // exact 9:16 (0.5625)
  const lowKeyPortrait = await makeParsedPng(width, height, (x, y) => {
    const nx = (x - width / 2) / (width / 2);
    const ny = (y - height * 0.46) / (height * 0.36);
    const dist2 = nx * nx + ny * ny;
    if (dist2 >= 1) return [6, 6, 8];
    const glow = Math.round((1 - dist2) * 165);
    return [Math.min(255, 10 + glow), Math.min(255, 8 + Math.round(glow * 0.78)), Math.min(255, 8 + Math.round(glow * 0.65))];
  });

  const result = await unwrapAnalyzeScreenshotImage(lowKeyPortrait);
  assert.equal(result.screenshotCropped, false);
  assert.equal(result.image, lowKeyPortrait);
});

test("does not crop a 9:16 graphic poster on a solid colored canvas", async () => {
  const poster = await makeParsedPng(450, 800, (x, y) => {
    if (x > 90 && x < 360 && y > 220 && y < 580) {
      return [245, 220, 90];
    }
    return [24, 58, 135]; // deep royal blue poster canvas
  });

  const result = await unwrapAnalyzeScreenshotImage(poster);
  assert.equal(result.screenshotCropped, false);
  assert.equal(result.image, poster);
});

test("crops light-theme Instagram/gallery screenshot bars while preserving inner portrait", async () => {
  const width = 390;
  const height = 844;
  const topBarEnd = 52;
  const bottomBarStart = 640;

  const lightUiShot = await makeParsedPng(width, height, (x, y) => {
    if (y < topBarEnd) {
      // Dark clock/icons on white header
      if (y >= 16 && y <= 28 && x >= 30 && x <= 140 && x % 4 === 0) {
        return [28, 28, 28];
      }
      return [252, 252, 252];
    }
    if (y >= bottomBarStart) {
      if (y === 775) return [222, 222, 222];
      if (
        (y >= 665 && y <= 680 && x >= 24 && x <= 240 && x % 4 === 0) ||
        (y >= 792 && y <= 812 && x % 75 >= 30 && x % 75 <= 44 && (x + y) % 2 === 0)
      ) {
        return [35, 35, 35];
      }
      return [250, 250, 250];
    }
    // Inner outdoor portrait with natural contrast against white UI bars
    return [72, 112, 96];
  });

  const result = await unwrapAnalyzeScreenshotImage(lightUiShot);
  assert.equal(result.screenshotCropped, true);
  assert.ok(
    Math.abs((result.croppedHeight ?? 0) - (bottomBarStart - topBarEnd)) <= 18,
    `expected croppedHeight near ${bottomBarStart - topBarEnd}, got ${result.croppedHeight}`,
  );
});

