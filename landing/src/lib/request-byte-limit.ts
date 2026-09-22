export class PayloadTooLargeError extends Error {
  constructor() {
    super("payload_too_large");
    this.name = "PayloadTooLargeError";
  }
}

export function isPayloadTooLarge(error: unknown): error is PayloadTooLargeError {
  return error instanceof PayloadTooLargeError;
}

export function contentLengthExceeds(headers: Headers, maxBytes: number): boolean {
  const declared = Number(headers.get("content-length") || 0);
  return Number.isFinite(declared) && declared > maxBytes;
}

type ByteStream =
  | Pick<Request, "headers" | "body">
  | Pick<Response, "headers" | "body">;

export async function readLimitedResponseBytes(
  source: ByteStream,
  maxBytes: number,
): Promise<Uint8Array> {
  if (contentLengthExceeds(source.headers, maxBytes)) {
    throw new PayloadTooLargeError();
  }
  if (!source.body) throw new PayloadTooLargeError();
  const reader = source.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new PayloadTooLargeError();
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

export async function readRequestJson(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  if (contentLengthExceeds(request.headers, maxBytes)) {
    throw new PayloadTooLargeError();
  }
  if (!request.body) throw new PayloadTooLargeError();
  const bytes = await readLimitedResponseBytes(request, maxBytes);
  try {
    return JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    throw new SyntaxError("invalid_json");
  }
}

export async function readBlobBytes(blob: Blob, maxBytes: number): Promise<Uint8Array> {
  if (blob.size > maxBytes) throw new PayloadTooLargeError();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw new PayloadTooLargeError();
  return bytes;
}
