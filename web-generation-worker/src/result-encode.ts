import sharp from "sharp";

export const JPEG_QUALITY = 85;

/**
 * imgproxy default `IMGPROXY_MAX_SRC_RESOLUTION` is 16.8 MP.
 * Sources above that return 422 Invalid source image, and Next logs
 * `upstream image response failed` 400 for every thumbnail.
 * 4096×4096 still fits; a tall Gemini frame (3072×5504) does not.
 */
export const STORAGE_RENDER_MAX_SRC_PIXELS = 16_777_216;

export type ResultImageKind = "jpeg" | "png" | "webp" | "unknown";
export type ResultOutputFormat = "jpeg" | "png" | "original";
export type ResultEncodeSkippedReason =
  | "already_jpeg"
  | "encode_failed"
  | "no_gain"
  | "src_pixel_budget"
  | null;
export type ResultExtension = "jpg" | "png" | "webp";
export type ResultContentType = "image/jpeg" | "image/png" | "image/webp";

export type EncodedGenerationResult = {
  buffer: Buffer;
  extension: ResultExtension;
  contentType: ResultContentType;
  bytesIn: number;
  bytesOut: number;
  outputFormat: ResultOutputFormat;
  encodeMs: number;
  skippedReason: ResultEncodeSkippedReason;
};

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function asBuffer(input: Buffer): Buffer {
  return Buffer.isBuffer(input) ? input : Buffer.from(input);
}

export function detectImageKind(input: Buffer): ResultImageKind {
  const buffer = asBuffer(input);
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_MAGIC)) {
    return "png";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return "unknown";
}

function identityForKind(kind: ResultImageKind): {
  extension: ResultExtension;
  contentType: ResultContentType;
  outputFormat: ResultOutputFormat;
} {
  if (kind === "jpeg") {
    return { extension: "jpg", contentType: "image/jpeg", outputFormat: "jpeg" };
  }
  if (kind === "png") {
    return { extension: "png", contentType: "image/png", outputFormat: "png" };
  }
  if (kind === "webp") {
    return { extension: "webp", contentType: "image/webp", outputFormat: "original" };
  }
  return { extension: "png", contentType: "image/png", outputFormat: "original" };
}

/** Largest integer box that keeps aspect and stays within `maxPixels`. */
export function fitInsidePixelBudget(
  width: number,
  height: number,
  maxPixels: number,
): { width: number; height: number } {
  if (width < 1 || height < 1 || maxPixels < 1) {
    return { width: Math.max(0, width), height: Math.max(0, height) };
  }
  if (width * height <= maxPixels) return { width, height };
  const scale = Math.sqrt(maxPixels / (width * height));
  let nextWidth = Math.max(1, Math.floor(width * scale));
  let nextHeight = Math.max(1, Math.floor(height * scale));
  while (nextWidth * nextHeight > maxPixels) {
    if (nextWidth >= nextHeight && nextWidth > 1) nextWidth -= 1;
    else if (nextHeight > 1) nextHeight -= 1;
    else break;
  }
  return { width: nextWidth, height: nextHeight };
}

function unchanged(
  buffer: Buffer,
  kind: ResultImageKind,
  encodeMs: number,
  skippedReason: ResultEncodeSkippedReason,
): EncodedGenerationResult {
  const identity = identityForKind(kind);
  return {
    buffer,
    extension: identity.extension,
    contentType: identity.contentType,
    bytesIn: buffer.length,
    bytesOut: buffer.length,
    outputFormat: identity.outputFormat,
    encodeMs,
    skippedReason,
  };
}

async function fitSourceToRenderBudget(
  buffer: Buffer,
  maxSrcPixels: number,
  started: number,
  bytesIn: number,
): Promise<EncodedGenerationResult | null> {
  let width = 0;
  let height = 0;
  try {
    const meta = await sharp(buffer, { failOn: "none" }).rotate().metadata();
    width = meta.width || 0;
    height = meta.height || 0;
  } catch {
    return null;
  }
  if (width < 1 || height < 1 || width * height <= maxSrcPixels) return null;

  const box = fitInsidePixelBudget(width, height, maxSrcPixels);
  try {
    const encoded = await sharp(buffer, { failOn: "none" })
      .rotate()
      .resize({ width: box.width, height: box.height, fit: "fill" })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
    return {
      buffer: encoded,
      extension: "jpg",
      contentType: "image/jpeg",
      bytesIn,
      bytesOut: encoded.length,
      outputFormat: "jpeg",
      encodeMs: Date.now() - started,
      skippedReason: "src_pixel_budget",
    };
  } catch {
    return null;
  }
}

export async function encodeGenerationResult(
  input: Buffer,
  options?: { maxSrcPixels?: number },
): Promise<EncodedGenerationResult> {
  const buffer = asBuffer(input);
  const bytesIn = buffer.length;
  const kind = detectImageKind(buffer);
  const started = Date.now();
  const maxSrcPixels = options?.maxSrcPixels ?? STORAGE_RENDER_MAX_SRC_PIXELS;
  const fitted = await fitSourceToRenderBudget(buffer, maxSrcPixels, started, bytesIn);
  if (fitted) return fitted;

  if (kind === "jpeg") {
    return unchanged(buffer, kind, Date.now() - started, "already_jpeg");
  }

  try {
    const encoded = await sharp(buffer)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
    const encodeMs = Date.now() - started;
    if (encoded.length >= bytesIn) {
      return unchanged(buffer, kind, encodeMs, "no_gain");
    }
    return {
      buffer: encoded,
      extension: "jpg",
      contentType: "image/jpeg",
      bytesIn,
      bytesOut: encoded.length,
      outputFormat: "jpeg",
      encodeMs,
      skippedReason: null,
    };
  } catch {
    return unchanged(buffer, kind, Date.now() - started, "encode_failed");
  }
}
