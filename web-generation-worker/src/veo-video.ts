export const VEO_LITE_VIDEO_MODEL = "veo-3.1-lite-generate-preview";
export const GEMINI_API_HOST = "generativelanguage.googleapis.com";

export function isVeoLiteVideoModel(model: unknown): boolean {
  return typeof model === "string" && model.startsWith("veo-3.1-lite");
}

export function normalizeVeoLiteDurationSeconds(value: unknown): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (parsed === 6 || parsed === 8) return parsed;
  if (parsed === 10) return 8;
  return 4;
}

export function veoSubmitUrl(baseUrl: string, model: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const id = model.trim() || VEO_LITE_VIDEO_MODEL;
  return `${base}/v1beta/models/${id}:predictLongRunning`;
}

export function veoPollUrl(baseUrl: string, operationName: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const name = operationName.replace(/^\/+/, "");
  if (name.startsWith("v1beta/")) return `${base}/${name}`;
  return `${base}/v1beta/${name}`;
}

export function buildVeoLiteSubmitBody(input: {
  prompt: string;
  image: { mimeType: string; data: string };
  aspectRatio: string;
  durationSeconds?: number | null;
  resolution?: string | null;
}): Record<string, unknown> {
  const aspectRatio = input.aspectRatio === "16:9" ? "16:9" : "9:16";
  return {
    instances: [
      {
        prompt: input.prompt,
        image: {
          bytesBase64Encoded: input.image.data,
          mimeType: input.image.mimeType || "image/jpeg",
        },
      },
    ],
    parameters: {
      aspectRatio,
      durationSeconds: normalizeVeoLiteDurationSeconds(input.durationSeconds),
      resolution: input.resolution === "1080p" ? "1080p" : "720p",
      personGeneration: "allow_adult",
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function extractVeoOperationName(payload: Record<string, unknown>): string {
  const name = payload.name;
  return typeof name === "string" ? name.trim() : "";
}

export function isVeoOperationDone(payload: Record<string, unknown>): boolean {
  return payload.done === true;
}

export function isVeoOperationFailed(payload: Record<string, unknown>): boolean {
  return Boolean(asRecord(payload.error));
}

export type VeoVideoRef = {
  kind: "inline" | "uri";
  data?: string;
  uri?: string;
};

function videoFromSample(sample: unknown): VeoVideoRef | null {
  const video = asRecord(asRecord(sample)?.video) || asRecord(sample);
  if (!video) return null;
  const inline =
    (typeof video.bytesBase64Encoded === "string" && video.bytesBase64Encoded) ||
    (typeof video.data === "string" && video.data) ||
    (typeof video.videoBytes === "string" && video.videoBytes);
  if (inline) return { kind: "inline", data: inline };
  const uri =
    (typeof video.uri === "string" && video.uri) ||
    (typeof video.url === "string" && video.url);
  if (uri) return { kind: "uri", uri };
  return null;
}

export function extractVeoVideo(payload: Record<string, unknown>): VeoVideoRef | null {
  const response = asRecord(payload.response) || payload;
  const generate = asRecord(response.generateVideoResponse) || response;
  const samples = generate.generatedSamples || generate.generatedVideos;
  if (Array.isArray(samples)) {
    for (const sample of samples) {
      const video = videoFromSample(sample);
      if (video) return video;
    }
  }
  return videoFromSample(generate.video || response.video);
}

export function rewriteGeminiMediaUrl(mediaUrl: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  try {
    const parsed = new URL(mediaUrl);
    if (parsed.hostname !== GEMINI_API_HOST) return mediaUrl;
    return `${base}${parsed.pathname}${parsed.search}`;
  } catch {
    if (mediaUrl.startsWith("/")) return `${base}${mediaUrl}`;
    return mediaUrl;
  }
}

export function veoErrorMessage(payload: Record<string, unknown>): string {
  const error = asRecord(payload.error);
  const response = asRecord(payload.response);
  const generate = asRecord(response?.generateVideoResponse);
  const reasons = generate?.raiMediaFilteredReasons;
  const reasonText = Array.isArray(reasons)
    ? reasons.filter((item) => typeof item === "string").join(" | ")
    : "";
  const chunks = [
    typeof error?.message === "string" ? error.message : "",
    typeof error?.status === "string" ? error.status : "",
    typeof payload.message === "string" ? payload.message : "",
    reasonText,
  ].filter(Boolean);
  return (chunks.join(" | ") || "Video generation failed").slice(0, 2000);
}

export function isVeoSafetyBlock(payload: Record<string, unknown>, message: string): boolean {
  const generate = asRecord(asRecord(payload.response)?.generateVideoResponse);
  if (Number(generate?.raiMediaFilteredCount) > 0) return true;
  return /safety|policy|blocked|prohibited|rai|filtered|usage.?guideline/i.test(message);
}
