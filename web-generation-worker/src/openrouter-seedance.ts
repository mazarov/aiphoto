import {
  SEEDANCE_25_OPENROUTER_MODEL,
  SEEDANCE_25_VIDEO_MODEL,
  isSeedanceVideoModel,
} from "../../landing/src/lib/generation/image-options";
import {
  OPENROUTER_APP_TITLE,
  OPENROUTER_HTTP_REFERER,
  isProxiedReferenceUrl,
  openrouterProxyHost,
  requireOpenRouterBaseUrl,
} from "./openrouter-seedream";

export {
  SEEDANCE_25_OPENROUTER_MODEL,
  SEEDANCE_25_VIDEO_MODEL,
  isSeedanceVideoModel,
  openrouterProxyHost,
  requireOpenRouterBaseUrl,
};

export const SEEDANCE_SUBMIT_TIMEOUT_MS = 30_000;
export const SEEDANCE_POLL_TIMEOUT_MS = 30_000;
export const SEEDANCE_DOWNLOAD_TIMEOUT_MS = 60_000;
export const SEEDANCE_DOWNLOAD_MAX_BYTES = 80 * 1024 * 1024;
export const SEEDANCE_ALLOWED_DURATIONS = [4, 6, 8, 10] as const;

export function openrouterVideoSubmitUrl(baseUrl: string): string {
  return `${requireOpenRouterBaseUrl(baseUrl)}/api/v1/videos`;
}

export function openrouterVideoPollUrl(baseUrl: string, jobId: string): string {
  return `${requireOpenRouterBaseUrl(baseUrl)}/api/v1/videos/${encodeURIComponent(jobId)}`;
}

export function openrouterVideoContentUrl(baseUrl: string, jobId: string): string {
  return `${openrouterVideoPollUrl(baseUrl, jobId)}/content`;
}

export function openrouterVideoHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "HTTP-Referer": OPENROUTER_HTTP_REFERER,
    "X-Title": OPENROUTER_APP_TITLE,
  };
}

export function buildSeedanceVideoSubmitBody(input: {
  prompt: string;
  imageUrl: string;
  durationSeconds: number;
  aspectRatio: string;
  resolution?: string;
  generateAudio?: boolean;
  model?: string;
}): Record<string, unknown> {
  if (isProxiedReferenceUrl(input.imageUrl)) {
    throw new Error("seedance_image_input_must_be_public_url");
  }
  const aspectRatio = input.aspectRatio === "16:9" ? "16:9" : "9:16";
  const resolution = input.resolution === "480p" ? "480p" : "720p";
  const duration = SEEDANCE_ALLOWED_DURATIONS.includes(
    input.durationSeconds as (typeof SEEDANCE_ALLOWED_DURATIONS)[number],
  )
    ? input.durationSeconds
    : 4;
  const vendorModel = input.model?.includes("/")
    ? input.model
    : SEEDANCE_25_OPENROUTER_MODEL;
  return {
    model: vendorModel,
    prompt: input.prompt,
    duration,
    resolution,
    aspect_ratio: aspectRatio,
    generate_audio: input.generateAudio !== false,
    frame_images: [
      {
        type: "image_url",
        image_url: { url: input.imageUrl },
        frame_type: "first_frame",
      },
    ],
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function extractSeedanceJobId(payload: Record<string, unknown>): string {
  const id = payload.id;
  return typeof id === "string" ? id.trim() : "";
}

export function seedanceStatus(payload: Record<string, unknown>): string {
  return String(payload.status || payload.state || "").toLowerCase();
}

export function isSeedancePending(status: string): boolean {
  return ["pending", "in_progress", "queued", "processing"].includes(status);
}

export function isSeedanceDone(status: string): boolean {
  return ["completed", "succeeded", "success", "done"].includes(status);
}

export function isSeedanceFailed(status: string): boolean {
  return ["failed", "error", "cancelled", "canceled"].includes(status);
}

export function isSeedanceExpired(status: string): boolean {
  return status === "expired";
}

export function seedanceErrorMessage(payload: Record<string, unknown>): string {
  const error = payload.error;
  const nested = asRecord(error);
  const chunks = [
    typeof payload.message === "string" ? payload.message : "",
    typeof error === "string" ? error : "",
    typeof nested?.message === "string" ? nested.message : "",
    typeof nested?.code === "string" ? nested.code : "",
    typeof payload.status === "string" ? payload.status : "",
  ].filter(Boolean);
  return (chunks.join(" | ") || "Video generation failed").slice(0, 2000);
}

export function isSeedanceSafetyBlock(payload: Record<string, unknown>, message: string): boolean {
  const error = asRecord(payload.error);
  const haystack = [
    message,
    String(error?.code || ""),
    String(error?.status || ""),
    String(payload.status || ""),
    String(payload.error || ""),
  ].join(" ");
  return /safety|policy|blocked|prohibited|usage.?guideline|moderation|nsfw|flagged/i.test(haystack);
}

export function seedanceFailureFromHttp(
  payload: Record<string, unknown>,
  status: number,
): { errorType: string; message: string; retryable: boolean } {
  const message = seedanceErrorMessage(payload);
  if (isSeedanceSafetyBlock(payload, message) || isSeedanceExpired(seedanceStatus(payload))) {
    return {
      errorType: isSeedanceExpired(seedanceStatus(payload)) ? "provider_expired" : "safety_block",
      message,
      retryable: false,
    };
  }
  if (status === 401 || status === 402) {
    return { errorType: "config_error", message, retryable: false };
  }
  if (status === 429 || status >= 500) {
    return { errorType: `seedance_http_${status}`, message, retryable: true };
  }
  if (status === 403) {
    return {
      errorType: "seedance_http_403",
      message: message || "Seedance proxy returned 403",
      retryable: true,
    };
  }
  return { errorType: "provider_error", message, retryable: false };
}
