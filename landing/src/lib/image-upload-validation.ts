const GENERATOR_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type GeneratorMime = (typeof GENERATOR_MIMES)[number];

const FILENAME_EXT_ALIASES: Record<string, "jpeg" | "png" | "gif" | "webp"> = {
  jpg: "jpeg",
  jpeg: "jpeg",
  jpe: "jpeg",
  jfif: "jpeg",
  pjpeg: "jpeg",
  pjp: "jpeg",
  jepg: "jpeg",
  png: "png",
  gif: "gif",
  webp: "webp",
  wepb: "webp",
};

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

export function sniffImageMimeFromUint8(u8: Uint8Array): GeneratorMime | null {
  if (!u8 || u8.length < 2) return null;
  const n = Math.min(u8.length, 12);
  const head = u8.subarray(0, n);

  if (head.length >= 2 && head[0] === 0xff && head[1] === 0xd8) return "image/jpeg";
  if (
    head.length >= 8 &&
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47
  ) {
    return "image/png";
  }
  if (head.length >= 6 && head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46) return "image/gif";
  if (
    head.length >= 12 &&
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function filenameExtHint(filename: string): GeneratorMime | null {
  const match = /\.([a-z0-9]+)$/i.exec(filename.trim());
  if (!match) return null;
  const ext = match[1].toLowerCase();
  const canonical = FILENAME_EXT_ALIASES[ext] ?? ext;
  if (canonical === "jpeg") return "image/jpeg";
  if (canonical === "png") return "image/png";
  if (canonical === "gif") return "image/gif";
  if (canonical === "webp") return "image/webp";
  return null;
}

function safeArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error || new Error("FileReader failed"));
    reader.readAsArrayBuffer(blob);
  });
}

export async function validateImageUploadFile(
  file: Blob & { name?: string },
): Promise<{ ok: true; mime: GeneratorMime; source: "signature" | "metadata" } | { ok: false }> {
  // If reading magic bytes hangs (e.g. Chrome picker bug), we'll fallback to metadata
  let head: Uint8Array | null = null;
  try {
    const slice = file.slice(0, 16);
    const buffer = await Promise.race([
      new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error || new Error("FileReader failed"));
        reader.readAsArrayBuffer(slice);
      }),
      new Promise<ArrayBuffer>((_, reject) => setTimeout(() => reject(new Error("timeout")), 500))
    ]);
    head = new Uint8Array(buffer);
  } catch (err) {
    console.debug("[aid-upload] validate signature read failed or timed out", err);
  }

  if (head) {
    const sniffed = sniffImageMimeFromUint8(head);
    if (sniffed) return { ok: true, mime: sniffed, source: "signature" };
  }

  const declared = normalizeMimeLabel(file.type || "");
  if (isGeneratorImageMime(declared)) return { ok: true, mime: declared, source: "metadata" };

  const fromName = filenameExtHint(typeof file.name === "string" ? file.name : "");
  if (fromName) return { ok: true, mime: fromName, source: "metadata" };

  return { ok: false };
}
