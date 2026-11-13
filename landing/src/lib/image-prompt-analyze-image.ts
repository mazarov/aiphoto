import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import sharp from "sharp";
import {
  isPayloadTooLarge,
  readLimitedResponseBytes,
} from "@/lib/request-byte-limit";
import { isSharpBusyError, runSharpLimited } from "@/lib/sharp-runtime";
import {
  inferAspectRatioFromDimensions,
  type ExtensionImageSettings,
} from "@/lib/extension-image-settings";

export const ANALYZE_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** JSON body cap: 10 MB image as base64 plus a small envelope. */
export const ANALYZE_REQUEST_MAX_BYTES = 14 * 1024 * 1024;
/** Interactive extract via DO proxy. ~85KB (768/q85) dies with EPIPE/ETIMEDOUT. */
export const ANALYZE_GEMINI_MAX_EDGE = 256;
export const ANALYZE_GEMINI_MAX_BYTES = 20 * 1024;
const MAX_BASE64_CHARS = Math.ceil(ANALYZE_MAX_IMAGE_BYTES * (4 / 3)) + 100;
const IMAGE_FETCH_TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 5;

export type ParsedAnalyzeImage = {
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  data: string;
};

export type UnwrappedAnalyzeScreenshot = {
  image: ParsedAnalyzeImage;
  screenshotCropped: boolean;
  originalHeight?: number;
  croppedHeight?: number;
};

const SCREENSHOT_MIN_HEIGHT = 400;
const SCREENSHOT_MIN_ASPECT = 0.38;
const SCREENSHOT_MAX_ASPECT = 0.58;
/** Near 9:16 (0.5625) we require UI glyphs inside the flat bar to avoid cropping low-key portraits or letterbox art. */
const SCREENSHOT_NEAR_9_16_ASPECT = 0.53;
const SCREENSHOT_SCAN_WIDTH = 144;
const SCREENSHOT_TOP_MAX_RATIO = 0.18;
const SCREENSHOT_BOTTOM_MAX_RATIO = 0.42;
const SCREENSHOT_MIN_REMAINING_RATIO = 0.5;
const SCREENSHOT_MIN_REMAINING_HEIGHT = 200;
const SCREENSHOT_MIN_TRIM_RATIO = 0.06;

type ScanRowStats = {
  darkBgRatio: number;
  lightBgRatio: number;
  darkUiRowRatio: number;
  lightUiRowRatio: number;
  darkGlyphRatio: number;
  lightGlyphRatio: number;
  meanLuma: number;
  meanChroma: number;
};

function computeScanRowStats(
  raw: Uint8Array,
  width: number,
  height: number,
  channels: number,
): ScanRowStats[] {
  const rows: ScanRowStats[] = new Array(height);
  const invW = 1 / width;
  for (let y = 0; y < height; y += 1) {
    let darkBg = 0;
    let lightBg = 0;
    let darkUiCompatible = 0;
    let lightUiCompatible = 0;
    let darkGlyph = 0;
    let lightGlyph = 0;
    let lumaSum = 0;
    let chromaSum = 0;
    const rowOffset = y * width * channels;
    for (let x = 0; x < width; x += 1) {
      const idx = rowOffset + x * channels;
      const r = raw[idx] ?? 0;
      const g = raw[idx + 1] ?? 0;
      const b = raw[idx + 2] ?? 0;
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const chroma = maxC - minC;
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      lumaSum += luma;
      chromaSum += chroma;
      if (maxC <= 32 && chroma <= 18) {
        darkBg += 1;
        darkUiCompatible += 1;
      } else {
        if (luma >= 95) darkGlyph += 1;
        // Neutral text/icon glyphs, anti-aliased glyph edges, or dark pill boxes sitting on a dark UI panel
        if (chroma <= 24) {
          darkUiCompatible += 1;
        }
      }
      if (minC >= 232 && chroma <= 18) {
        lightBg += 1;
        lightUiCompatible += 1;
      } else {
        if (luma <= 150) lightGlyph += 1;
        if (chroma <= 24) {
          lightUiCompatible += 1;
        }
      }
    }
    rows[y] = {
      darkBgRatio: darkBg * invW,
      lightBgRatio: lightBg * invW,
      darkUiRowRatio: darkUiCompatible * invW,
      lightUiRowRatio: lightUiCompatible * invW,
      darkGlyphRatio: darkGlyph * invW,
      lightGlyphRatio: lightGlyph * invW,
      meanLuma: lumaSum * invW,
      meanChroma: chromaSum * invW,
    };
  }
  return rows;
}

function rowIsSolidAnchor(row: ScanRowStats, theme: "dark" | "light"): boolean {
  return theme === "dark" ? row.darkBgRatio >= 0.78 : row.lightBgRatio >= 0.78;
}

function rowContinuesUiBlock(row: ScanRowStats, theme: "dark" | "light"): boolean {
  if (theme === "dark") {
    return (
      row.darkBgRatio >= 0.34 &&
      row.darkUiRowRatio >= 0.82 &&
      row.meanChroma <= 20 &&
      row.meanLuma <= 95
    );
  }
  return (
    row.lightBgRatio >= 0.34 &&
    row.lightUiRowRatio >= 0.82 &&
    row.meanChroma <= 20 &&
    row.meanLuma >= 160
  );
}

function rowGlyphRatioForTheme(row: ScanRowStats, theme: "dark" | "light"): number {
  return theme === "dark" ? row.darkGlyphRatio : row.lightGlyphRatio;
}

function hasSharpHorizontalSeam(
  rows: ScanRowStats[],
  boundaryRow: number,
  direction: 1 | -1,
  theme: "dark" | "light",
): boolean {
  const height = rows.length;
  const barIdx = boundaryRow - direction;
  if (barIdx < 0 || barIdx >= height || boundaryRow < 0 || boundaryRow >= height) {
    return false;
  }
  const barRow = rows[barIdx]!;
  // Downsampling creates 1 mixed transition scanline right at the seam; inspect 1..5 rows into content.
  const contentWindow = 5;
  let lumaDiffMax = 0;
  let nonBarRows = 0;
  let inspected = 0;
  for (let step = 0; step < contentWindow; step += 1) {
    const idx = boundaryRow + step * direction;
    if (idx < 0 || idx >= height) break;
    const candidate = rows[idx]!;
    inspected += 1;
    const bgRatio = theme === "dark" ? candidate.darkBgRatio : candidate.lightBgRatio;
    if (bgRatio <= 0.52) nonBarRows += 1;
    const diff = Math.abs(candidate.meanLuma - barRow.meanLuma);
    if (diff > lumaDiffMax) lumaDiffMax = diff;
  }
  if (inspected < 2) return false;
  const r0 = rows[boundaryRow]!;
  const r1 = rows[Math.min(height - 1, Math.max(0, boundaryRow + direction))]!;
  const r2 = rows[Math.min(height - 1, Math.max(0, boundaryRow + 2 * direction))]!;
  const nearJump = Math.max(
    Math.abs(r0.meanLuma - barRow.meanLuma),
    Math.abs(r1.meanLuma - barRow.meanLuma),
    Math.abs(r2.meanLuma - barRow.meanLuma),
  );
  const nearBgDrop =
    theme === "dark"
      ? barRow.darkBgRatio - Math.min(r0.darkBgRatio, r1.darkBgRatio, r2.darkBgRatio)
      : barRow.lightBgRatio - Math.min(r0.lightBgRatio, r1.lightBgRatio, r2.lightBgRatio);

  return (
    nonBarRows >= 2 &&
    nearBgDrop >= 0.35 &&
    (nearJump >= 24 || lumaDiffMax >= 30)
  );
}

function detectEdgeUiBarRows(
  rows: ScanRowStats[],
  edge: "top" | "bottom",
  maxRatio: number,
  requireGlyphs: boolean,
): number {
  const height = rows.length;
  const maxRows = Math.floor(height * maxRatio);
  if (maxRows < 3) return 0;

  const start = edge === "top" ? 0 : height - 1;
  const step: 1 | -1 = edge === "top" ? 1 : -1;

  // Determine bar theme from the outer 3 rows (skipping 1px screen-corner rounding artifacts if needed).
  const probe0 = rows[start]!;
  const probe1 = rows[start + step]!;
  const darkStart = rowIsSolidAnchor(probe0, "dark") || rowIsSolidAnchor(probe1, "dark");
  const lightStart = rowIsSolidAnchor(probe0, "light") || rowIsSolidAnchor(probe1, "light");
  if (!darkStart && !lightStart) return 0;
  const theme: "dark" | "light" = darkStart ? "dark" : "light";

  let lastAnchorCount = 0;
  let gapAllowance = 2; // Tolerate thin 1-2 row divider/badge lines inside a UI block.
  let glyphRows = 0;

  for (let i = 0; i < maxRows; i += 1) {
    const idx = start + i * step;
    const row = rows[idx]!;
    if (rowIsSolidAnchor(row, theme)) {
      lastAnchorCount = i + 1;
      gapAllowance = 2;
      if (rowGlyphRatioForTheme(row, theme) >= 0.015) {
        glyphRows += 1;
      }
      continue;
    }
    if (rowContinuesUiBlock(row, theme)) {
      gapAllowance = 2;
      if (rowGlyphRatioForTheme(row, theme) >= 0.015) {
        glyphRows += 1;
      }
      continue;
    }
    if (i > 0 && gapAllowance > 0 && row.meanChroma <= 24) {
      gapAllowance -= 1;
      continue;
    }
    break;
  }

  // Always snap the cut to the last truly solid background anchor row (>=78% flat background),
  // never inside photographic content.
  if (lastAnchorCount < 3) return 0;
  const boundaryRow = start + lastAnchorCount * step;
  if (!hasSharpHorizontalSeam(rows, boundaryRow, step, theme)) {
    return 0;
  }
  if (requireGlyphs && glyphRows < 1) {
    return 0;
  }
  return lastAnchorCount;
}

/**
 * Deterministically trims solid top/bottom OS or social-app UI bars on tall phone
 * screenshots before 256px/20KB Gemini compression. Falls back to the untouched
 * image whenever aspect ratio, seam sharpness, or remaining-area invariants fail.
 */
export async function unwrapAnalyzeScreenshotImage(
  image: ParsedAnalyzeImage,
): Promise<UnwrappedAnalyzeScreenshot> {
  const input = Buffer.from(image.data, "base64");
  try {
    const cropped = await runSharpLimited(async () => {
      const oriented = sharp(input).rotate();
      const meta = await oriented.metadata();
      const rawW = meta.width ?? 0;
      const rawH = meta.height ?? 0;
      const swapped = typeof meta.orientation === "number" && meta.orientation >= 5 && meta.orientation <= 8;
      const width = swapped ? rawH : rawW;
      const height = swapped ? rawW : rawH;

      if (height < SCREENSHOT_MIN_HEIGHT || width <= 0) return null;
      const aspect = width / height;
      if (aspect < SCREENSHOT_MIN_ASPECT || aspect > SCREENSHOT_MAX_ASPECT) {
        return null;
      }

      const scanW = Math.min(SCREENSHOT_SCAN_WIDTH, width);
      const scanH = Math.max(64, Math.round((height * scanW) / width));
      const { data: raw, info } = await sharp(input)
        .rotate()
        .resize(scanW, scanH, { fit: "fill" })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const rows = computeScanRowStats(raw, info.width, info.height, info.channels);
      const requireGlyphs = aspect >= SCREENSHOT_NEAR_9_16_ASPECT;
      const topScanRows = detectEdgeUiBarRows(rows, "top", SCREENSHOT_TOP_MAX_RATIO, requireGlyphs);
      const bottomScanRows = detectEdgeUiBarRows(rows, "bottom", SCREENSHOT_BOTTOM_MAX_RATIO, requireGlyphs);
      if (topScanRows === 0 && bottomScanRows === 0) return null;

      const scaleY = height / info.height;
      const topPx = Math.min(height - 1, Math.round(topScanRows * scaleY));
      const bottomPx = Math.min(height - 1, Math.round(bottomScanRows * scaleY));
      const trimRatio = (topPx + bottomPx) / height;
      const croppedHeight = height - topPx - bottomPx;

      if (
        trimRatio < SCREENSHOT_MIN_TRIM_RATIO ||
        croppedHeight < SCREENSHOT_MIN_REMAINING_HEIGHT ||
        croppedHeight / height < SCREENSHOT_MIN_REMAINING_RATIO
      ) {
        return null;
      }

      const extracted = await sharp(input)
        .rotate()
        .extract({ left: 0, top: topPx, width, height: croppedHeight })
        .jpeg({ quality: 92 })
        .toBuffer();
      const parsed = parseAnalyzeImageBuffer(extracted);
      if (!parsed) return null;
      return {
        image: parsed,
        screenshotCropped: true as const,
        originalHeight: height,
        croppedHeight,
      };
    });
    return cropped ?? { image, screenshotCropped: false };
  } catch (error) {
    if (isSharpBusyError(error)) throw error;
    return { image, screenshotCropped: false };
  }
}

export class AnalyzeImageError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "AnalyzeImageError";
  }
}

function sniffImageMime(buffer: Uint8Array): ParsedAnalyzeImage["mimeType"] | null {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46
  ) {
    return "image/gif";
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function parseAnalyzeImageBuffer(
  bytes: Uint8Array | Buffer,
): ParsedAnalyzeImage | null {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (!buffer.length || buffer.length > ANALYZE_MAX_IMAGE_BYTES) return null;
  const mimeType = sniffImageMime(buffer);
  return mimeType ? { mimeType, data: buffer.toString("base64") } : null;
}

export function parseAnalyzeImageDataUrl(value: string): ParsedAnalyzeImage | null {
  const match = /^data:\s*([^;,]+)\s*;\s*base64\s*,\s*([\s\S]+)$/i.exec(
    value.trim(),
  );
  if (!match) return null;
  const compact = match[2].replace(/\s/g, "");
  if (
    !compact ||
    compact.length > MAX_BASE64_CHARS ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(compact)
  ) {
    return null;
  }
  const buffer = Buffer.from(compact, "base64");
  if (!buffer.length || buffer.length > ANALYZE_MAX_IMAGE_BYTES) return null;
  const mimeType = sniffImageMime(buffer);
  return mimeType ? { mimeType, data: buffer.toString("base64") } : null;
}

export async function prepareAnalyzeImageForGemini(
  image: ParsedAnalyzeImage,
  options?: { maxEdge?: number; maxBytes?: number },
): Promise<ParsedAnalyzeImage> {
  const maxEdge = options?.maxEdge ?? ANALYZE_GEMINI_MAX_EDGE;
  const maxBytes = options?.maxBytes ?? ANALYZE_GEMINI_MAX_BYTES;
  const input = Buffer.from(image.data, "base64");
  const edges = [maxEdge, 384, 256, 192, 160].filter(
    (value, index, list) => value > 0 && value <= maxEdge && list.indexOf(value) === index,
  );
  let prepared: ParsedAnalyzeImage | null = null;
  try {
    prepared = await runSharpLimited(async () => {
      for (const edge of edges) {
        for (const quality of [72, 60, 48, 40]) {
          const resized = await sharp(input)
            .rotate()
            .resize(edge, edge, { fit: "inside", withoutEnlargement: true })
            .jpeg({ quality })
            .toBuffer();
          if (resized.length > maxBytes) continue;
          const parsed = parseAnalyzeImageBuffer(resized);
          if (parsed) return parsed;
        }
      }
      return null;
    });
  } catch (error) {
    if (isSharpBusyError(error)) throw error;
    throw new AnalyzeImageError("gemini_payload");
  }
  if (!prepared) throw new AnalyzeImageError("gemini_payload");
  return prepared;
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];
  if (isIP(normalized) === 4) {
    const [a, b] = normalized.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  if (isIP(normalized) === 6) {
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      /^fe[89ab]/.test(normalized) ||
      normalized.startsWith("ff") ||
      normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:192.168.")
    );
  }
  return true;
}

async function assertPublicImageUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AnalyzeImageError("invalid_protocol");
  }
  if (url.username || url.password) throw new AnalyzeImageError("invalid_url");
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.includes("metadata.google") ||
    host.endsWith(".internal")
  ) {
    throw new AnalyzeImageError("invalid_host");
  }
  const addresses = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true, verbatim: true }).catch(() => []);
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new AnalyzeImageError("invalid_host");
  }
}

async function readLimitedBody(response: Response): Promise<Uint8Array> {
  if (!response.body) throw new AnalyzeImageError("empty_body");
  try {
    return await readLimitedResponseBytes(response, ANALYZE_MAX_IMAGE_BYTES);
  } catch (error) {
    if (isPayloadTooLarge(error)) throw new AnalyzeImageError("too_large");
    throw error;
  }
}

export async function fetchAnalyzeImage(urlValue: string): Promise<ParsedAnalyzeImage> {
  let url: URL;
  try {
    url = new URL(urlValue);
  } catch {
    throw new AnalyzeImageError("invalid_url");
  }
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    await assertPublicImageUrl(url);
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
      headers: {
        Accept: "image/*,*/*;q=0.8",
        "User-Agent": "promptshot-image-fetch/1.0",
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirect === MAX_REDIRECTS) {
        throw new AnalyzeImageError("bad_redirect");
      }
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) throw new AnalyzeImageError(`http_${response.status}`);
    const bytes = await readLimitedBody(response);
    const mimeType = sniffImageMime(bytes);
    if (!mimeType) throw new AnalyzeImageError("unsupported_image");
    return { mimeType, data: Buffer.from(bytes).toString("base64") };
  }
  throw new AnalyzeImageError("bad_redirect");
}

export async function resolveAnalyzeImageFromBody(body: {
  image_base64?: unknown;
  image_url?: unknown;
}): Promise<
  | { ok: true; image: ParsedAnalyzeImage }
  | { ok: false; message: string; code?: string }
> {
  const rawBase64 = body.image_base64;
  const rawUrl = body.image_url;
  const hasBase64 = typeof rawBase64 === "string" && Boolean(rawBase64.trim());
  const hasUrl = typeof rawUrl === "string" && Boolean(rawUrl.trim());
  if (hasBase64 === hasUrl) {
    return {
      ok: false,
      message: hasBase64
        ? "Send either image_base64 or image_url, not both."
        : "Provide image_base64 or image_url.",
    };
  }
  try {
    if (hasBase64) {
      const parsed = parseAnalyzeImageDataUrl(String(rawBase64));
      if (!parsed) {
        return {
          ok: false,
          message:
            "image_base64 must be a valid JPEG, PNG, WebP, or GIF data URL under 10 MB.",
        };
      }
      return { ok: true, image: parsed };
    }
    return { ok: true, image: await fetchAnalyzeImage(String(rawUrl).trim()) };
  } catch (error) {
    const code = error instanceof AnalyzeImageError ? error.code : String(error);
    if (code === "too_large") {
      return { ok: false, code, message: "Image exceeds 10 MB limit." };
    }
    if (["invalid_url", "invalid_protocol"].includes(code)) {
      return { ok: false, code, message: "Invalid image URL." };
    }
    if (code === "invalid_host") {
      return { ok: false, code, message: "This URL is not allowed." };
    }
    return {
      ok: false,
      code,
      message: "Could not download a supported image from this URL.",
    };
  }
}

export async function analyzeImageSettings(
  data: string,
): Promise<ExtensionImageSettings | null> {
  try {
    const metadata = await runSharpLimited(() =>
      sharp(Buffer.from(data, "base64")).metadata(),
    );
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    const aspectRatio = inferAspectRatioFromDimensions(width, height);
    return aspectRatio ? { aspectRatio, width, height } : null;
  } catch (error) {
    if (isSharpBusyError(error)) throw error;
    return null;
  }
}
