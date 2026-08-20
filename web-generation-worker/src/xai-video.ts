export const GROK_IMAGINE_VIDEO_MODEL = "grok-imagine-video-1.5";
export const XAI_API_HOST = "api.x.ai";

export function isGrokVideoModel(model: unknown): boolean {
  return typeof model === "string" && model.startsWith("grok-imagine-video");
}

export function requireXaiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new Error("XAI_BASE_URL is not configured");
  }
  return trimmed;
}

export function xaiProxyHost(baseUrl: string): string {
  try {
    return new URL(requireXaiBaseUrl(baseUrl)).host;
  } catch {
    return "invalid";
  }
}

export function xaiSubmitUrl(baseUrl: string): string {
  return `${requireXaiBaseUrl(baseUrl)}/v1/videos/generations`;
}

export function xaiPollUrl(baseUrl: string, requestId: string): string {
  return `${requireXaiBaseUrl(baseUrl)}/v1/videos/${encodeURIComponent(requestId)}`;
}

export function buildXaiVideoSubmitBody(input: {
  model: string;
  prompt: string;
  imageUrl: string;
  durationSeconds: number;
  aspectRatio: string;
  resolution: string;
}): Record<string, unknown> {
  const aspectRatio = input.aspectRatio === "16:9" ? "16:9" : "9:16";
  const resolution = ["480p", "720p", "1080p"].includes(input.resolution)
    ? input.resolution
    : "720p";
  return {
    model: input.model || GROK_IMAGINE_VIDEO_MODEL,
    prompt: input.prompt,
    image: { url: input.imageUrl },
    duration: input.durationSeconds,
    aspect_ratio: aspectRatio,
    resolution,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function extractXaiRequestId(payload: Record<string, unknown>): string {
  const id = payload.request_id || payload.id;
  return typeof id === "string" ? id.trim() : "";
}

export function xaiStatus(payload: Record<string, unknown>): string {
  return String(payload.status || payload.state || "").toLowerCase();
}

export function isXaiDone(status: string): boolean {
  return ["done", "completed", "succeeded", "success"].includes(status);
}

export function isXaiFailed(status: string): boolean {
  return ["failed", "error", "cancelled", "canceled"].includes(status);
}

export function isXaiExpired(status: string): boolean {
  return status === "expired";
}

export function extractXaiVideoUrl(payload: Record<string, unknown>): string {
  const video = asRecord(payload.video);
  const candidates = [video?.url, video?.uri, payload.url];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function rewriteXaiDownloadUrl(videoUrl: string, baseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(videoUrl);
  } catch {
    return videoUrl;
  }
  if (parsed.hostname !== XAI_API_HOST) return videoUrl;
  const base = requireXaiBaseUrl(baseUrl);
  return `${base}${parsed.pathname}${parsed.search}`;
}

export function xaiErrorMessage(payload: Record<string, unknown>): string {
  const error = asRecord(payload.error);
  const chunks = [
    typeof payload.message === "string" ? payload.message : "",
    typeof error?.message === "string" ? error.message : "",
    typeof error?.code === "string" ? error.code : "",
    typeof payload.status === "string" ? payload.status : "",
  ].filter(Boolean);
  return (chunks.join(" | ") || "Video generation failed").slice(0, 2000);
}

export function isXaiSafetyBlock(payload: Record<string, unknown>, message: string): boolean {
  const error = asRecord(payload.error);
  const haystack = [
    message,
    String(error?.code || ""),
    String(error?.status || ""),
    String(payload.status || ""),
  ].join(" ");
  return /safety|policy|blocked|prohibited|usage.?guideline|moderation/i.test(haystack);
}
