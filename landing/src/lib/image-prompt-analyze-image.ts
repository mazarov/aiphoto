import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import sharp from "sharp";
import {
  inferAspectRatioFromDimensions,
  type ExtensionImageSettings,
} from "@/lib/extension-image-settings";

export const ANALYZE_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_BASE64_CHARS = Math.ceil(ANALYZE_MAX_IMAGE_BYTES * (4 / 3)) + 100;
const IMAGE_FETCH_TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 5;

export type ParsedAnalyzeImage = {
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  data: string;
};

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
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > ANALYZE_MAX_IMAGE_BYTES) {
    throw new AnalyzeImageError("too_large");
  }
  if (!response.body) throw new AnalyzeImageError("empty_body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > ANALYZE_MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new AnalyzeImageError("too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
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
    const metadata = await sharp(Buffer.from(data, "base64")).metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    const aspectRatio = inferAspectRatioFromDimensions(width, height);
    return aspectRatio ? { aspectRatio, width, height } : null;
  } catch {
    return null;
  }
}
