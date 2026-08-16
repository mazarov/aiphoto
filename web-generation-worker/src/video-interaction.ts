export type VideoInteractionRequest = {
  model: string;
  input: Array<Record<string, string>>;
  background: true;
  generation_config: {
    video_config: {
      task: "image_to_video";
    };
  };
  response_format: {
    type: "video";
    aspect_ratio: string;
  };
};

/** Official Omni Flash Interactions body. aspect_ratio lives on response_format, not video_config. */
export function buildVideoInteractionRequest(input: {
  model: string;
  prompt: string;
  image: { mimeType: string; data: string };
  aspectRatio: string;
}): VideoInteractionRequest {
  const aspectRatio = input.aspectRatio === "16:9" ? "16:9" : "9:16";
  return {
    model: input.model,
    input: [
      { type: "image", data: input.image.data, mime_type: input.image.mimeType },
      { type: "text", text: input.prompt },
    ],
    background: true,
    generation_config: {
      video_config: {
        task: "image_to_video",
      },
    },
    response_format: {
      type: "video",
      aspect_ratio: aspectRatio,
    },
  };
}

export type InteractionVideoRef = {
  kind: "inline" | "uri";
  data?: string;
  uri?: string;
  mimeType: string;
};

export function interactionStatus(payload: Record<string, unknown>): string {
  return String(payload.status || payload.state || "").toLowerCase();
}

export function isInteractionCompleted(status: string): boolean {
  return ["completed", "succeeded", "success", "done"].includes(status);
}

export function isInteractionFailed(status: string): boolean {
  return ["failed", "error", "cancelled", "canceled"].includes(status);
}

export function extractInteractionId(payload: Record<string, unknown>): string {
  const id = payload.id || payload.name;
  return typeof id === "string" ? id.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function videoRefFromContent(content: Record<string, unknown>): InteractionVideoRef | null {
  const type = String(content.type || content.kind || "").toLowerCase();
  const mimeType = String(
    content.mime_type || content.mimeType || "video/mp4"
  );
  const data = content.data || content.bytesBase64Encoded;
  if (typeof data === "string" && data.length > 0 && (type.includes("video") || mimeType.startsWith("video/"))) {
    return { kind: "inline", data, mimeType };
  }
  const uri =
    content.uri ||
    content.url ||
    (asRecord(content.output_video)?.uri as string | undefined) ||
    (asRecord(content.video)?.uri as string | undefined);
  if (typeof uri === "string" && uri.length > 0) {
    return { kind: "uri", uri, mimeType };
  }
  return null;
}

export function extractInteractionVideo(
  payload: Record<string, unknown>
): InteractionVideoRef | null {
  const buckets: unknown[] = [
    payload.output_video,
    payload.outputs,
    payload.output,
    payload.result,
    payload.steps,
    asRecord(payload.result)?.outputs,
    asRecord(payload.result)?.video,
  ];
  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) {
      const record = asRecord(bucket);
      if (record) {
        const direct = videoRefFromContent(record);
        if (direct) return direct;
      }
      continue;
    }
    for (const item of bucket) {
      const record = asRecord(item);
      if (!record) continue;
      const direct = videoRefFromContent(record);
      if (direct) return direct;
      const contents = record.content || record.contents || record.outputs;
      if (Array.isArray(contents)) {
        for (const part of contents) {
          const partRecord = asRecord(part);
          if (!partRecord) continue;
          const nested = videoRefFromContent(partRecord);
          if (nested) return nested;
        }
      }
    }
  }
  return null;
}

export function interactionErrorMessage(payload: Record<string, unknown>): string {
  const error = asRecord(payload.error);
  const chunks = [
    typeof payload.message === "string" ? payload.message : "",
    typeof error?.message === "string" ? error.message : "",
    typeof payload.status === "string" ? payload.status : "",
  ].filter(Boolean);
  return (chunks.join(" | ") || "Video generation failed").slice(0, 2000);
}

export function isSafetyBlock(payload: Record<string, unknown>, message: string): boolean {
  const error = asRecord(payload.error);
  const haystack = [
    message,
    String(error?.status || ""),
    String(payload.finish_reason || payload.finishReason || ""),
  ].join(" ");
  return /safety|policy|blocked|prohibited|blocklist/i.test(haystack);
}
