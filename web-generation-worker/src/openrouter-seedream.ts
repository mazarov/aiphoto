export const SEEDREAM_45_IMAGE_MODEL = "seedream-4.5";
export const SEEDREAM_45_OPENROUTER_MODEL = "bytedance-seed/seedream-4.5";
export const OPENROUTER_API_HOST = "openrouter.ai";
export const SEEDREAM_MAX_INPUTS = 10;
export const SEEDREAM_PROMPT_MAX_CHARS = 4000;
export const SEEDREAM_HTTP_TIMEOUT_MS = 180_000;
export const SEEDREAM_DOWNLOAD_TIMEOUT_MS = 20_000;
export const SEEDREAM_DOWNLOAD_MAX_BYTES = 25 * 1024 * 1024;
export const SEEDREAM_SIGNED_TTL_SEC = 900;
export const SEEDREAM_LEASE_HEARTBEAT_MS = 25_000;
export const OPENROUTER_HTTP_REFERER = "https://promptshot.ru";
export const OPENROUTER_APP_TITLE = "PromptShot";

export function isSeedreamImageModel(model: unknown): boolean {
  return typeof model === "string" && model.startsWith("seedream-");
}

export function requireOpenRouterBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new Error("OPENROUTER_BASE_URL is not configured");
  }
  if (!trimmed.includes("/u/")) {
    throw new Error("OPENROUTER_BASE_URL must use /u/ proxy");
  }
  return trimmed;
}

export function openrouterProxyHost(baseUrl: string): string {
  try {
    return new URL(requireOpenRouterBaseUrl(baseUrl)).host;
  } catch {
    return "invalid";
  }
}

export function openrouterProxyOrigin(baseUrl: string): string {
  const base = requireOpenRouterBaseUrl(baseUrl);
  const marker = "/u/";
  const index = base.indexOf(marker);
  if (index === -1) {
    throw new Error("OPENROUTER_BASE_URL must use /u/ proxy");
  }
  return base.slice(0, index);
}

export function seedreamSubmitUrl(baseUrl: string): string {
  return `${requireOpenRouterBaseUrl(baseUrl)}/api/v1/images`;
}

export function mapSeedreamImageSize(imageSize: string): { size: "2K" | "4K"; clamped: boolean } {
  const normalized = String(imageSize || "").trim().toUpperCase();
  if (normalized === "4K") return { size: "4K", clamped: false };
  if (normalized === "2K") return { size: "2K", clamped: false };
  return { size: "2K", clamped: true };
}

export function clampSeedreamImageUrls(urls: string[]): { urls: string[]; clamped: boolean } {
  if (urls.length <= SEEDREAM_MAX_INPUTS) return { urls, clamped: false };
  return { urls: urls.slice(0, SEEDREAM_MAX_INPUTS), clamped: true };
}

export function clampSeedreamPrompt(prompt: string): string {
  const text = String(prompt || "");
  return text.length <= SEEDREAM_PROMPT_MAX_CHARS
    ? text
    : text.slice(0, SEEDREAM_PROMPT_MAX_CHARS);
}

export function isProxiedReferenceUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.pathname.startsWith("/u/");
  } catch {
    return true;
  }
}

export function buildSeedreamImageBody(input: {
  prompt: string;
  size: "2K" | "4K";
  aspectRatio: string;
  imageInput?: string[];
  model?: string;
}): Record<string, unknown> {
  const imageInput = clampSeedreamImageUrls(input.imageInput || []).urls;
  if (imageInput.some((url) => isProxiedReferenceUrl(url))) {
    throw new Error("seedream_image_input_must_be_public_url");
  }
  const payload: Record<string, unknown> = {
    model: input.model || SEEDREAM_45_OPENROUTER_MODEL,
    prompt: clampSeedreamPrompt(input.prompt),
    n: 1,
    resolution: input.size,
    aspect_ratio: input.aspectRatio,
    output_format: "png",
  };
  if (imageInput.length) {
    payload.input_references = imageInput.map((url) => ({
      type: "image_url",
      image_url: { url },
    }));
  }
  return payload;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function isAllowedOpenRouterHost(hostname: string): boolean {
  return hostname === OPENROUTER_API_HOST;
}

export function rewriteOpenRouterUrl(
  assetUrl: string,
  baseUrl: string,
): { url: string; host: string } {
  let parsed: URL;
  try {
    parsed = new URL(assetUrl);
  } catch {
    throw new Error("invalid_openrouter_url");
  }
  if (!isAllowedOpenRouterHost(parsed.hostname)) {
    throw new Error(`unsupported_delivery_host:${parsed.hostname}`);
  }
  const origin = openrouterProxyOrigin(baseUrl);
  return {
    url: `${origin}/u/${parsed.hostname}${parsed.pathname}${parsed.search}`,
    host: parsed.hostname,
  };
}

export function extractSeedreamImageBase64(payload: Record<string, unknown>): string {
  const data = payload.data;
  if (Array.isArray(data)) {
    const first = asRecord(data[0]);
    const b64 = first?.b64_json;
    if (typeof b64 === "string" && b64.trim()) return b64.trim();
  }
  if (typeof payload.b64_json === "string" && payload.b64_json.trim()) {
    return payload.b64_json.trim();
  }
  return "";
}

export function extractSeedreamImageUrl(payload: Record<string, unknown>): string {
  const data = payload.data;
  if (Array.isArray(data)) {
    const first = asRecord(data[0]);
    if (typeof first?.url === "string" && first.url.trim()) return first.url.trim();
  }
  if (typeof payload.url === "string" && payload.url.trim()) return payload.url.trim();
  return "";
}

export function extractSeedreamOperationId(payload: Record<string, unknown>): string {
  if (typeof payload.id === "string" && payload.id.trim()) return payload.id.trim();
  const created = payload.created;
  if (typeof created === "number" && Number.isFinite(created)) {
    return `openrouter:${created}`;
  }
  return "";
}

export function seedreamErrorMessage(payload: Record<string, unknown>): string {
  const error = payload.error;
  const nested = asRecord(error);
  const chunks = [
    typeof payload.message === "string" ? payload.message : "",
    typeof error === "string" ? error : "",
    typeof nested?.message === "string" ? nested.message : "",
    typeof payload.status === "string" ? payload.status : "",
  ].filter(Boolean);
  return (chunks.join(" | ") || "Seedream generation failed").slice(0, 2000);
}

export function isSeedreamSafetyBlock(payload: Record<string, unknown>, message: string): boolean {
  const haystack = [message, String(payload.error || ""), String(payload.status || "")].join(" ");
  return /safety|nsfw|moderat|sensitive|flagged|prohibited|blocked|content.?policy/i.test(haystack);
}

export function decodeSeedreamBase64(b64: string): Buffer {
  const buffer = Buffer.from(b64, "base64");
  if (!buffer.length) {
    throw Object.assign(new Error("Seedream returned empty image bytes"), {
      errorType: "provider_error",
      retryable: false,
    });
  }
  if (buffer.length > SEEDREAM_DOWNLOAD_MAX_BYTES) {
    throw Object.assign(new Error("Seedream output exceeds 25 MB"), {
      errorType: "provider_error",
      retryable: false,
    });
  }
  return buffer;
}

export type SeedreamFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export async function runSeedreamImage(input: {
  apiKey: string;
  baseUrl: string;
  body: Record<string, unknown>;
  persistOperationId?: (id: string) => Promise<void>;
  ensureLease: () => Promise<void>;
  signal: AbortSignal;
  circuitOpen?: boolean;
  fetchImpl?: SeedreamFetch;
  onLog?: (event: string, fields: Record<string, unknown>) => void;
}): Promise<{ buffer: Buffer; operationId: string }> {
  const fetchImpl = input.fetchImpl || fetch;
  const log = input.onLog || (() => undefined);
  const baseUrl = requireOpenRouterBaseUrl(input.baseUrl);
  if (!input.apiKey.trim()) {
    throw Object.assign(new Error("OPENROUTER_API_KEY is not configured"), { errorType: "config_error" });
  }
  if (input.circuitOpen) {
    log("seedream_circuit_open", { proxyHost: openrouterProxyHost(baseUrl) });
    throw Object.assign(new Error("Seedream circuit is open"), {
      errorType: "provider_error",
      retryable: true,
    });
  }

  await input.ensureLease();
  log("seedream_submit", { proxyHost: openrouterProxyHost(baseUrl) });
  const created = await withLeaseHeartbeat(input.ensureLease, () => requestJson(fetchImpl, {
    url: seedreamSubmitUrl(baseUrl),
    method: "POST",
    token: input.apiKey,
    body: input.body,
    signal: input.signal,
    timeoutMs: SEEDREAM_HTTP_TIMEOUT_MS,
  }));
  throwIfSeedreamHttpError(created.payload, created.status);

  const operationId = extractSeedreamOperationId(created.payload);
  if (operationId && input.persistOperationId) {
    try {
      await input.persistOperationId(operationId);
    } catch (error) {
      log("seedream_persist_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const b64 = extractSeedreamImageBase64(created.payload);
  if (b64) {
    const buffer = decodeSeedreamBase64(b64);
    log("seedream_download_inline", { bytes: buffer.length });
    return { buffer, operationId };
  }

  const outputUrl = extractSeedreamImageUrl(created.payload);
  if (!outputUrl) {
    throw Object.assign(new Error(seedreamErrorMessage(created.payload) || "Seedream returned an empty output"), {
      errorType: "provider_error",
      retryable: false,
    });
  }
  let rewritten: { url: string; host: string };
  try {
    rewritten = rewriteOpenRouterUrl(outputUrl, baseUrl);
  } catch (error) {
    throw Object.assign(new Error(error instanceof Error ? error.message : String(error)), {
      errorType: "provider_error",
      retryable: false,
    });
  }
  log("seedream_download_rewritten", { outputHost: rewritten.host });
  const buffer = await downloadSeedreamOutput(fetchImpl, rewritten.url, input.signal, input.apiKey);
  return { buffer, operationId };
}

async function withLeaseHeartbeat<T>(
  ensureLease: () => Promise<void>,
  work: () => Promise<T>,
): Promise<T> {
  const timer = setInterval(() => {
    void ensureLease().catch(() => undefined);
  }, SEEDREAM_LEASE_HEARTBEAT_MS);
  try {
    return await work();
  } finally {
    clearInterval(timer);
  }
}

function throwIfSeedreamHttpError(payload: Record<string, unknown>, status: number): void {
  const message = seedreamErrorMessage(payload);
  if (isSeedreamSafetyBlock(payload, message)) {
    throw Object.assign(new Error(message), { errorType: "safety_block", retryable: false });
  }
  if (status === 401 || status === 402) {
    throw Object.assign(new Error(message), { errorType: "config_error", retryable: false });
  }
  if (status === 429 || status >= 500) {
    throw Object.assign(new Error(message), {
      errorType: `seedream_http_${status}`,
      retryable: true,
    });
  }
  if (status === 403) {
    throw Object.assign(new Error(message || "Seedream proxy returned 403"), {
      errorType: "seedream_http_403",
      retryable: true,
    });
  }
  if (status >= 400) {
    throw Object.assign(new Error(message), { errorType: "provider_error", retryable: false });
  }
}

async function requestJson(
  fetchImpl: SeedreamFetch,
  input: {
    url: string;
    method: "GET" | "POST";
    token: string;
    body?: Record<string, unknown>;
    signal: AbortSignal;
    timeoutMs: number;
  },
): Promise<{ status: number; payload: Record<string, unknown> }> {
  let response: Response;
  try {
    response = await fetchImpl(input.url, {
      method: input.method,
      headers: {
        Authorization: `Bearer ${input.token}`,
        "HTTP-Referer": OPENROUTER_HTTP_REFERER,
        "X-Title": OPENROUTER_APP_TITLE,
        ...(input.method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      body: input.method === "POST" ? JSON.stringify(input.body || {}) : undefined,
      signal: AbortSignal.any([input.signal, AbortSignal.timeout(input.timeoutMs)]),
    });
  } catch (error) {
    if (input.signal.aborted) {
      throw Object.assign(new Error("Worker is shutting down"), {
        errorType: "shutdown",
        retryable: true,
      });
    }
    const timeout = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
    throw Object.assign(new Error(error instanceof Error ? error.message : String(error)), {
      errorType: timeout ? "timeout" : "network_error",
      retryable: true,
    });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    if (!response.ok) {
      throw Object.assign(new Error(`Seedream returned non-JSON (HTTP ${response.status})`), {
        errorType: response.status === 429 || response.status >= 500
          ? `seedream_http_${response.status}`
          : "provider_error",
        retryable: response.status === 429 || response.status >= 500,
      });
    }
  }
  return { status: response.status, payload };
}

async function downloadSeedreamOutput(
  fetchImpl: SeedreamFetch,
  url: string,
  signal: AbortSignal,
  token: string,
): Promise<Buffer> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "HTTP-Referer": OPENROUTER_HTTP_REFERER,
        "X-Title": OPENROUTER_APP_TITLE,
      },
      signal: AbortSignal.any([signal, AbortSignal.timeout(SEEDREAM_DOWNLOAD_TIMEOUT_MS)]),
    });
  } catch (error) {
    if (signal.aborted) {
      throw Object.assign(new Error("Worker is shutting down"), {
        errorType: "shutdown",
        retryable: true,
      });
    }
    throw Object.assign(new Error(error instanceof Error ? error.message : String(error)), {
      errorType: "network_error",
      retryable: true,
    });
  }
  if (!response.ok) {
    throw Object.assign(new Error(`Seedream download HTTP ${response.status}`), {
      errorType: response.status === 429 || response.status >= 500
        ? `seedream_http_${response.status}`
        : "provider_error",
      retryable: response.status === 429 || response.status >= 500,
    });
  }
  const announced = Number(response.headers.get("content-length") || 0);
  if (announced > SEEDREAM_DOWNLOAD_MAX_BYTES) {
    throw Object.assign(new Error("Seedream output exceeds 25 MB"), {
      errorType: "provider_error",
      retryable: false,
    });
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) {
    throw Object.assign(new Error("Seedream download is empty"), {
      errorType: "provider_error",
      retryable: false,
    });
  }
  if (buffer.length > SEEDREAM_DOWNLOAD_MAX_BYTES) {
    throw Object.assign(new Error("Seedream output exceeds 25 MB"), {
      errorType: "provider_error",
      retryable: false,
    });
  }
  return buffer;
}
