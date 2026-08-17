import {
  VISUAL_EMBEDDING_DIMENSIONS,
  VISUAL_EMBEDDING_MODEL_DEFAULT,
} from "@/lib/visual-search-config";

const DIRECT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";

export type GeminiEmbeddingErrorCode =
  | "missing_key"
  | "timeout"
  | "rate_limited"
  | "provider_error"
  | "request_error"
  | "malformed_vector";

export class GeminiEmbeddingError extends Error {
  readonly code: GeminiEmbeddingErrorCode;
  readonly httpStatus: number | null;

  constructor(
    code: GeminiEmbeddingErrorCode,
    message: string,
    httpStatus: number | null = null,
  ) {
    super(message);
    this.name = "GeminiEmbeddingError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export function formatVisualSearchQuery(
  query: string,
  useTaskPrefix = true,
): string {
  const trimmed = query.trim();
  return useTaskPrefix ? `task: search result | query: ${trimmed}` : trimmed;
}

export function assertEmbeddingVector(
  values: unknown,
  dimensions = VISUAL_EMBEDDING_DIMENSIONS,
): number[] {
  if (!Array.isArray(values) || values.length !== dimensions) {
    throw new GeminiEmbeddingError(
      "malformed_vector",
      `expected ${dimensions} embedding values`,
    );
  }
  const nums = values.map((value) => Number(value));
  if (nums.some((value) => !Number.isFinite(value))) {
    throw new GeminiEmbeddingError(
      "malformed_vector",
      "embedding contains non-finite values",
    );
  }
  return nums;
}

export function embeddingToRpcLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

function geminiBaseUrl(useProxy: boolean): string {
  if (useProxy) {
    const proxy = String(process.env.GEMINI_PROXY_BASE_URL ?? "")
      .trim()
      .replace(/\/+$/, "");
    if (proxy) return proxy;
  }
  return DIRECT_GEMINI_BASE_URL;
}

type EmbedPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

type EmbedContentResponse = {
  embedding?: { values?: unknown };
};

function classifyHttpError(status: number): GeminiEmbeddingErrorCode {
  if (status === 429) return "rate_limited";
  if (status >= 500) return "provider_error";
  return "request_error";
}

export async function embedGeminiContent(options: {
  parts: EmbedPart[];
  model?: string;
  timeoutMs: number;
  useProxy?: boolean;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}): Promise<number[]> {
  const apiKey = (options.apiKey ?? process.env.GEMINI_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new GeminiEmbeddingError("missing_key", "GEMINI_API_KEY is not set");
  }

  const model =
    (options.model ?? process.env.GEMINI_EMBEDDING_MODEL ?? "").trim() ||
    VISUAL_EMBEDDING_MODEL_DEFAULT;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  const onOuterAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onOuterAbort, { once: true });

  try {
    const fetchImpl = options.fetchImpl ?? fetch;
    const url = `${geminiBaseUrl(options.useProxy !== false)}/v1beta/models/${model}:embedContent`;
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: `models/${model}`,
        content: { parts: options.parts },
        output_dimensionality: VISUAL_EMBEDDING_DIMENSIONS,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new GeminiEmbeddingError(
        classifyHttpError(response.status),
        `embedContent failed with ${response.status}`,
        response.status,
      );
    }

    const payload = (await response.json()) as EmbedContentResponse;
    return assertEmbeddingVector(payload.embedding?.values);
  } catch (error) {
    if (error instanceof GeminiEmbeddingError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new GeminiEmbeddingError("timeout", "embedContent timed out");
    }
    throw new GeminiEmbeddingError(
      "provider_error",
      error instanceof Error ? error.message : "embedContent failed",
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onOuterAbort);
  }
}

export function embedSearchQuery(options: {
  query: string;
  timeoutMs: number;
  useTaskPrefix?: boolean;
  model?: string;
  useProxy?: boolean;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}): Promise<number[]> {
  return embedGeminiContent({
    parts: [
      {
        text: formatVisualSearchQuery(options.query, options.useTaskPrefix !== false),
      },
    ],
    timeoutMs: options.timeoutMs,
    model: options.model,
    useProxy: options.useProxy,
    apiKey: options.apiKey,
    fetchImpl: options.fetchImpl,
    signal: options.signal,
  });
}

export function embedImageBytes(options: {
  bytes: Uint8Array;
  mimeType: string;
  timeoutMs: number;
  model?: string;
  useProxy?: boolean;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}): Promise<number[]> {
  return embedGeminiContent({
    parts: [
      {
        inline_data: {
          mime_type: options.mimeType,
          data: Buffer.from(options.bytes).toString("base64"),
        },
      },
    ],
    timeoutMs: options.timeoutMs,
    model: options.model,
    useProxy: options.useProxy,
    apiKey: options.apiKey,
    fetchImpl: options.fetchImpl,
    signal: options.signal,
  });
}
