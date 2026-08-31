import { DEFAULT_VIDEO_PROMPT } from "./generation/image-options";
import { videoI2vUserPrompt } from "./video-motion-prompt";

export const LISTING_VIDEO_REPEAT_KIND = "listing_video_repeat" as const;
export const LISTING_VIDEO_REPEAT_CONFIG_KEY = "listing_video_repeat_chain";

export type ListingVideoRepeatSpec = {
  kind: typeof LISTING_VIDEO_REPEAT_KIND;
  videoPrompt: string;
  videoModel: string;
  durationSeconds: number;
  aspectRatio: string;
  resolution: string;
  credits: number;
};

export type ListingVideoRepeatClientPipeline = {
  kind: typeof LISTING_VIDEO_REPEAT_KIND;
  videoPrompt?: string;
  videoModel?: string;
  durationSeconds?: number;
  aspectRatio?: string;
  resolution?: string;
};

export type ListingVideoRepeatImageJob = {
  id: string;
  user_id: string;
  requester_auth_user_id: string | null;
  card_id?: string | null;
  pipeline_trace_id?: string | null;
  pipeline_spec?: unknown;
};

export function parseListingVideoRepeatClientPipeline(
  raw: unknown,
): ListingVideoRepeatClientPipeline | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (value.kind !== LISTING_VIDEO_REPEAT_KIND) return null;
  return {
    kind: LISTING_VIDEO_REPEAT_KIND,
    videoPrompt: typeof value.videoPrompt === "string" ? value.videoPrompt : "",
    videoModel: typeof value.videoModel === "string" ? value.videoModel : undefined,
    durationSeconds:
      typeof value.durationSeconds === "number" ? value.durationSeconds : undefined,
    aspectRatio: typeof value.aspectRatio === "string" ? value.aspectRatio : undefined,
    resolution: typeof value.resolution === "string" ? value.resolution : undefined,
  };
}

export function parseListingVideoRepeatSpec(
  raw: unknown,
): ListingVideoRepeatSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (value.kind !== LISTING_VIDEO_REPEAT_KIND) return null;
  const videoPrompt =
    videoI2vUserPrompt(String(value.videoPrompt || "")) || DEFAULT_VIDEO_PROMPT;
  const videoModel = String(value.videoModel || "").trim();
  const durationSeconds = Number(value.durationSeconds);
  const aspectRatio = String(value.aspectRatio || "").trim();
  const resolution = String(value.resolution || "").trim();
  const credits = Number(value.credits);
  if (!videoModel || !aspectRatio || !resolution) return null;
  if (!Number.isInteger(durationSeconds) || durationSeconds < 1) return null;
  if (!Number.isInteger(credits) || credits < 0) return null;
  return {
    kind: LISTING_VIDEO_REPEAT_KIND,
    videoPrompt,
    videoModel,
    durationSeconds,
    aspectRatio,
    resolution,
    credits,
  };
}

export function listingVideoRepeatFollowupIdempotencyKey(
  imageGenerationId: string,
): string {
  return `listing-video-repeat:${String(imageGenerationId || "").trim()}`;
}
