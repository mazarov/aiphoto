export const SEEDREAM_45_IMAGE_MODEL = "seedream-4.5";
export const SEEDREAM_45_REPLICATE_MODEL = "bytedance/seedream-4.5";
export const REPLICATE_API_HOST = "api.replicate.com";
export const SEEDREAM_MAX_INPUTS = 10;
export const SEEDREAM_PROMPT_MAX_CHARS = 4000;
export const SEEDREAM_POLL_MS = 2500;
export const SEEDREAM_DEADLINE_MS = 180_000;
export const SEEDREAM_HTTP_TIMEOUT_MS = 20_000;
export const SEEDREAM_DOWNLOAD_MAX_BYTES = 25 * 1024 * 1024;
export const SEEDREAM_CANCEL_AFTER = "180";
export const SEEDREAM_SIGNED_TTL_SEC = 900;

const REPLICATE_DELIVERY_HOSTS = new Set(["replicate.delivery", "pbxt.replicate.delivery"]);

export function isSeedreamImageModel(model: unknown): boolean {
  return typeof model === "string" && model.startsWith("seedream-");
}

export function requireReplicateBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new Error("REPLICATE_BASE_URL is not configured");
  }
  if (!trimmed.includes("/u/")) {
    throw new Error("REPLICATE_BASE_URL must use /u/ proxy");
  }
  return trimmed;
}

export function replicateProxyHost(baseUrl: string): string {
  try {
    return new URL(requireReplicateBaseUrl(baseUrl)).host;
  } catch {
    return "invalid";
  }
}

export function replicateProxyOrigin(baseUrl: string): string {
  const base = requireReplicateBaseUrl(baseUrl);
  const marker = "/u/";
  const index = base.indexOf(marker);
  if (index === -1) {
    throw new Error("REPLICATE_BASE_URL must use /u/ proxy");
  }
  return base.slice(0, index);
}

export function seedreamSubmitUrl(
  baseUrl: string,
  replicateModel = SEEDREAM_45_REPLICATE_MODEL,
): string {
  return `${requireReplicateBaseUrl(baseUrl)}/v1/models/${replicateModel}/predictions`;
}

export function seedreamPollUrl(baseUrl: string, predictionId: string): string {
  return `${requireReplicateBaseUrl(baseUrl)}/v1/predictions/${encodeURIComponent(predictionId)}`;
}

export function shouldSubmitSeedreamPrediction(operationId: string | null | undefined): boolean {
  return !String(operationId || "").trim();
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

export function buildSeedreamPredictionBody(input: {
  prompt: string;
  size: "2K" | "4K";
  aspectRatio: string;
  imageInput?: string[];
}): Record<string, unknown> {
  const imageInput = clampSeedreamImageUrls(input.imageInput || []).urls;
  if (imageInput.some((url) => isProxiedReferenceUrl(url))) {
    throw new Error("seedream_image_input_must_be_public_url");
  }
  const payload: Record<string, unknown> = {
    prompt: clampSeedreamPrompt(input.prompt),
    size: input.size,
    aspect_ratio: input.aspectRatio,
    sequential_image_generation: "disabled",
    max_images: 1,
  };
  if (imageInput.length) payload.image_input = imageInput;
  return { input: payload };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function rewriteReplicateApiUrl(apiUrl: string, baseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(apiUrl);
  } catch {
    return "";
  }
  if (parsed.hostname !== REPLICATE_API_HOST) return "";
  return `${requireReplicateBaseUrl(baseUrl)}${parsed.pathname}${parsed.search}`;
}

export function isAllowedReplicateDeliveryHost(hostname: string): boolean {
  return REPLICATE_DELIVERY_HOSTS.has(hostname) || hostname.endsWith(".replicate.delivery");
}

export function rewriteReplicateDeliveryUrl(
  outputUrl: string,
  baseUrl: string,
): { url: string; host: string } {
  let parsed: URL;
  try {
    parsed = new URL(outputUrl);
  } catch {
    throw new Error("invalid_delivery_url");
  }
  if (!isAllowedReplicateDeliveryHost(parsed.hostname)) {
    throw new Error(`unsupported_delivery_host:${parsed.hostname}`);
  }
  const origin = replicateProxyOrigin(baseUrl);
  return {
    url: `${origin}/u/${parsed.hostname}${parsed.pathname}${parsed.search}`,
    host: parsed.hostname,
  };
}

export function extractSeedreamPredictionId(payload: Record<string, unknown>): string {
  return typeof payload.id === "string" ? payload.id.trim() : "";
}

export function extractSeedreamOutputUrl(payload: Record<string, unknown>): string {
  const output = payload.output;
  if (typeof output === "string" && output.trim()) return output.trim();
  if (Array.isArray(output)) {
    const first = output.find((item) => typeof item === "string" && item.trim());
    if (typeof first === "string") return first.trim();
  }
  return "";
}

export function extractSeedreamPollUrl(
  payload: Record<string, unknown>,
  baseUrl: string,
  predictionId: string,
): string {
  const urls = asRecord(payload.urls);
  const get = typeof urls?.get === "string" ? urls.get.trim() : "";
  if (get) {
    const rewritten = rewriteReplicateApiUrl(get, baseUrl);
    if (rewritten) return rewritten;
  }
  return seedreamPollUrl(baseUrl, predictionId);
}

export function seedreamPredictionStatus(payload: Record<string, unknown>): string {
  return String(payload.status || "").toLowerCase();
}

export function isSeedreamSucceeded(status: string): boolean {
  return status === "succeeded";
}

export function isSeedreamFailed(status: string): boolean {
  return ["failed", "canceled", "cancelled", "aborted"].includes(status);
}

export function seedreamErrorMessage(payload: Record<string, unknown>): string {
  const error = payload.error;
  const chunks = [
    typeof payload.message === "string" ? payload.message : "",
    typeof error === "string" ? error : "",
    typeof asRecord(error)?.message === "string" ? String(asRecord(error)?.message) : "",
    typeof payload.status === "string" ? payload.status : "",
  ].filter(Boolean);
  return (chunks.join(" | ") || "Seedream prediction failed").slice(0, 2000);
}

export function isSeedreamSafetyBlock(payload: Record<string, unknown>, message: string): boolean {
  const haystack = [message, String(payload.error || ""), String(payload.status || "")].join(" ");
  return /safety|nsfw|moderat|sensitive|flagged|prohibited|blocked|content.?policy/i.test(haystack);
}

export type SeedreamFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export async function runSeedreamPrediction(input: {
  apiToken: string;
  baseUrl: string;
  replicateModel?: string;
  existingOperationId?: string | null;
  body: Record<string, unknown>;
  persistOperationId: (id: string) => Promise<void>;
  ensureLease: () => Promise<void>;
  signal: AbortSignal;
  circuitOpen?: boolean;
  fetchImpl?: SeedreamFetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  onLog?: (event: string, fields: Record<string, unknown>) => void;
}): Promise<{ buffer: Buffer; operationId: string; submitted: boolean }> {
  const fetchImpl = input.fetchImpl || fetch;
  const now = input.now || Date.now;
  const sleep = input.sleep || ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const log = input.onLog || (() => undefined);
  const baseUrl = requireReplicateBaseUrl(input.baseUrl);
  if (!input.apiToken.trim()) {
    throw Object.assign(new Error("REPLICATE_API_TOKEN is not configured"), { errorType: "config_error" });
  }

  let operationId = String(input.existingOperationId || "").trim();
  let submitted = false;
  let payload: Record<string, unknown> = {};

  if (shouldSubmitSeedreamPrediction(operationId)) {
    if (input.circuitOpen) {
      log("seedream_circuit_open", { proxyHost: replicateProxyHost(baseUrl) });
      throw Object.assign(new Error("Seedream circuit is open"), {
        errorType: "provider_error",
        retryable: true,
      });
    }
    await input.ensureLease();
    log("seedream_submit", { proxyHost: replicateProxyHost(baseUrl) });
    const created = await requestJson(fetchImpl, {
      url: seedreamSubmitUrl(baseUrl, input.replicateModel),
      method: "POST",
      token: input.apiToken,
      body: input.body,
      signal: input.signal,
      headers: { "Cancel-After": SEEDREAM_CANCEL_AFTER },
    });
    payload = created.payload;
    operationId = extractSeedreamPredictionId(payload);
    if (!operationId) {
      log("seedream_submit_lost", { httpStatus: created.status });
      throw Object.assign(new Error(seedreamErrorMessage(payload) || "Seedream submit returned no id"), {
        errorType: created.status >= 500 || created.status === 429 ? `seedream_http_${created.status}` : "provider_error",
        retryable: created.status === 429 || created.status >= 500,
      });
    }
    submitted = true;
    try {
      await input.persistOperationId(operationId);
    } catch (error) {
      log("seedream_submit_lost", {
        persistFailed: true,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    throwIfSeedreamTerminal(payload, created.status);
  }

  const deadline = now() + SEEDREAM_DEADLINE_MS;
  while (!isSeedreamSucceeded(seedreamPredictionStatus(payload)) || !extractSeedreamOutputUrl(payload)) {
    if (now() >= deadline) {
      throw Object.assign(new Error("Seedream prediction timed out"), {
        errorType: "timeout",
        retryable: true,
      });
    }
    await input.ensureLease();
    const pollUrl = extractSeedreamPollUrl(payload, baseUrl, operationId);
    const polled = await requestJson(fetchImpl, {
      url: pollUrl,
      method: "GET",
      token: input.apiToken,
      signal: input.signal,
    });
    payload = polled.payload;
    log("seedream_prediction_poll", {
      id: operationId,
      status: seedreamPredictionStatus(payload),
    });
    throwIfSeedreamTerminal(payload, polled.status);
    if (isSeedreamSucceeded(seedreamPredictionStatus(payload)) && extractSeedreamOutputUrl(payload)) {
      break;
    }
    await sleep(SEEDREAM_POLL_MS);
  }

  const outputUrl = extractSeedreamOutputUrl(payload);
  if (!outputUrl) {
    throw Object.assign(new Error("Seedream returned an empty output"), {
      errorType: "provider_error",
      retryable: false,
    });
  }
  let rewritten: { url: string; host: string };
  try {
    rewritten = rewriteReplicateDeliveryUrl(outputUrl, baseUrl);
  } catch (error) {
    throw Object.assign(new Error(error instanceof Error ? error.message : String(error)), {
      errorType: "provider_error",
      retryable: false,
    });
  }
  log("seedream_download_rewritten", { outputHost: rewritten.host });
  const buffer = await downloadSeedreamOutput(fetchImpl, rewritten.url, input.signal);
  return { buffer, operationId, submitted };
}

function throwIfSeedreamTerminal(payload: Record<string, unknown>, status: number): void {
  const message = seedreamErrorMessage(payload);
  if (isSeedreamSafetyBlock(payload, message)) {
    throw Object.assign(new Error(message), { errorType: "safety_block", retryable: false });
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
  const predictionStatus = seedreamPredictionStatus(payload);
  if (isSeedreamFailed(predictionStatus)) {
    throw Object.assign(new Error(message), {
      errorType: predictionStatus === "failed" ? "provider_error" : "timeout",
      retryable: false,
    });
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
    headers?: Record<string, string>;
  },
): Promise<{ status: number; payload: Record<string, unknown> }> {
  let response: Response;
  try {
    response = await fetchImpl(input.url, {
      method: input.method,
      headers: {
        Authorization: `Bearer ${input.token}`,
        ...(input.method === "POST" ? { "Content-Type": "application/json" } : {}),
        ...input.headers,
      },
      body: input.method === "POST" ? JSON.stringify(input.body || {}) : undefined,
      signal: AbortSignal.any([input.signal, AbortSignal.timeout(SEEDREAM_HTTP_TIMEOUT_MS)]),
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
): Promise<Buffer> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(SEEDREAM_HTTP_TIMEOUT_MS)]),
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
