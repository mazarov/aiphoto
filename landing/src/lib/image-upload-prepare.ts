/**
 * Browser file preparation for the lite extension / landing widget.
 *
 * Chrome has a long-standing bug where files coming out of `<input type="file">`
 * sometimes become "ghost blobs": URL.createObjectURL works, the file shows up
 * in <img>, but every direct JS read (blob.arrayBuffer, FileReader, slice)
 * hangs forever. To stay reliable we make the <img> + canvas path PRIMARY and
 * keep FileReader-based reads only as a last-resort fallback.
 */
import { filenameExtHint } from "./image-upload-validation";

export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
export const UPLOAD_PREPARE_TIMEOUT_MS = 15_000;

const GENERATOR_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type GeneratorMime = (typeof GENERATOR_MIMES)[number];

export type UploadPrepareError = "invalid_type" | "too_large" | "read_failed";

export type UploadPrepareResult =
  | { ok: true; dataUrl: string; mime: GeneratorMime }
  | { ok: false; error: UploadPrepareError };

function withTimeout<T>(promise: Promise<T>, ms: number, label = "timeout"): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`prepare_timeout: ${label}`)), ms);
    }),
  ]);
}

function normalizeMimeLabel(raw: string): string {
  const t = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!t || t === "application/octet-stream") return "";
  if (t === "image/jpg" || t === "image/pjpeg" || t === "image/jfif") return "image/jpeg";
  if (t === "image/x-webp") return "image/webp";
  return t;
}

function isGeneratorImageMime(mime: string): mime is GeneratorMime {
  return (GENERATOR_MIMES as readonly string[]).includes(mime);
}

/**
 * Pick a sane MIME by metadata only — never touches the bytes (those reads hang
 * on Chrome picker files). If we can't tell from `file.type` or extension, we
 * default to "image/jpeg"; the API and the resize step will still re-derive
 * the actual type from the canvas output.
 */
function pickMimeFromMetadata(file: Blob & { name?: string }): GeneratorMime {
  const declared = normalizeMimeLabel(file.type || "");
  if (isGeneratorImageMime(declared)) return declared;
  const fromName = filenameExtHint(typeof file.name === "string" ? file.name : "");
  if (fromName) return fromName;
  return "image/jpeg";
}

function looksLikeImageByMetadata(file: Blob & { name?: string }): boolean {
  const declared = normalizeMimeLabel(file.type || "");
  if (declared.startsWith("image/")) return true;
  if (isGeneratorImageMime(declared)) return true;
  if (filenameExtHint(typeof file.name === "string" ? file.name : "")) return true;
  return false;
}

function canvasJpegDataUrlFromSource(
  source: CanvasImageSource & {
    width?: number;
    height?: number;
    naturalWidth?: number;
    naturalHeight?: number;
    close?: () => void;
  },
  maxPx: number,
  quality: number,
): string {
  const srcW = source.naturalWidth || source.width || 0;
  const srcH = source.naturalHeight || source.height || 0;
  if (!srcW || !srcH) throw new Error("empty_image");

  const scale = Math.min(1, maxPx / Math.max(srcW, srcH));
  const dstW = Math.max(1, Math.round(srcW * scale));
  const dstH = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = dstW;
  canvas.height = dstH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no_canvas_2d");
  ctx.drawImage(source, 0, 0, dstW, dstH);
  source.close?.();
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * PRIMARY path: decode the file via <img src=objectURL>. The browser's image
 * loader uses a different code path than JS blob reads and survives the
 * "ghost blob" picker bug.
 */
async function dataUrlViaHtmlImage(file: Blob, maxPx: number, quality: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("img_decode_failed"));
      el.src = url;
    });
    return canvasJpegDataUrlFromSource(img, maxPx, quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Secondary workaround: pull the bytes through `fetch(objectURL)` which goes
 * through the network stack and often succeeds when direct blob reads hang.
 */
async function blobViaFetchObjectUrl(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const response = await fetch(url);
    return await response.blob();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Last-resort FileReader fallback — usually hangs on the same files. */
function blobToDataUrlViaReader(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      if (!/^data:image\//i.test(result)) {
        reject(new Error("invalid_data_url"));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("read_failed"));
    reader.readAsDataURL(blob);
  });
}

export async function prepareUploadFile(
  file: Blob & { name?: string; size?: number },
  opts: { maxBytes?: number; maxPx?: number; quality?: number; timeoutMs?: number } = {},
): Promise<UploadPrepareResult> {
  const maxBytes = opts.maxBytes ?? UPLOAD_MAX_BYTES;
  const maxPx = opts.maxPx ?? 1024;
  const quality = opts.quality ?? 0.85;
  const totalTimeout = opts.timeoutMs ?? UPLOAD_PREPARE_TIMEOUT_MS;

  if (!looksLikeImageByMetadata(file)) return { ok: false, error: "invalid_type" };

  const size = typeof file.size === "number" ? file.size : 0;
  if (size > maxBytes) return { ok: false, error: "too_large" };

  const mime = pickMimeFromMetadata(file);

  try {
    const dataUrl = await withTimeout(
      dataUrlViaHtmlImage(file, maxPx, quality),
      Math.min(10_000, totalTimeout),
      "img_decode",
    );
    return { ok: true, dataUrl, mime };
  } catch (err1) {
    console.debug("[aid-upload] <img> path failed", err1);
  }

  try {
    const refreshed = await withTimeout(blobViaFetchObjectUrl(file), 6_000, "fetch_objecturl");
    const dataUrl = await withTimeout(
      dataUrlViaHtmlImage(refreshed, maxPx, quality),
      Math.min(10_000, totalTimeout),
      "img_decode_after_fetch",
    );
    return { ok: true, dataUrl, mime };
  } catch (err2) {
    console.debug("[aid-upload] fetch(objectURL) path failed", err2);
  }

  try {
    const dataUrl = await withTimeout(
      blobToDataUrlViaReader(file),
      Math.min(8_000, totalTimeout),
      "filereader",
    );
    return { ok: true, dataUrl, mime };
  } catch (err3) {
    console.debug("[aid-upload] FileReader fallback failed", err3);
  }

  return { ok: false, error: "read_failed" };
}

export function noticeForUploadError(
  error: UploadPrepareError,
  t: (key: "tooLarge" | "readFailed" | "invalidType") => string,
): string {
  if (error === "too_large") return t("tooLarge");
  if (error === "read_failed") return t("readFailed");
  return t("invalidType");
}
