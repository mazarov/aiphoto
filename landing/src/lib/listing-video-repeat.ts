import { createHash } from "node:crypto";
import { DEFAULT_VIDEO_PROMPT } from "./generation/image-options";
import { videoI2vUserPrompt } from "./video-motion-prompt";

/** Duck-typed so worker tsc does not resolve landing's @supabase/supabase-js. */
export type ListingVideoRepeatEnqueueClient = {
  rpc: (fn: string, args: Record<string, unknown>) => unknown;
};

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

function enqueueRowId(data: unknown): string {
  const row = Array.isArray(data) ? data[0] : data;
  if (row && typeof row === "object" && "generation_id" in row) {
    return String((row as { generation_id: unknown }).generation_id || "");
  }
  return "";
}

export async function enqueueListingVideoRepeatFollowup(
  supabase: ListingVideoRepeatEnqueueClient,
  job: ListingVideoRepeatImageJob,
): Promise<{ generationId: string | null; error: string | null }> {
  const spec = parseListingVideoRepeatSpec(job.pipeline_spec);
  const requesterId = String(job.requester_auth_user_id || "").trim();
  if (!spec || !requesterId || !job.id || !job.user_id) {
    return { generationId: null, error: null };
  }
  const idempotencyKey = listingVideoRepeatFollowupIdempotencyKey(job.id);
  const requestFingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        kind: LISTING_VIDEO_REPEAT_KIND,
        parentGenerationId: job.id,
        prompt: spec.videoPrompt,
        model: spec.videoModel,
        aspectRatio: spec.aspectRatio,
        imageSize: spec.resolution,
        durationSeconds: spec.durationSeconds,
      }),
    )
    .digest("hex");
  const { data, error } = (await supabase.rpc("landing_enqueue_generation", {
    p_user_id: job.user_id,
    p_requester_auth_user_id: requesterId,
    p_idempotency_key: idempotencyKey,
    p_request_fingerprint: requestFingerprint,
    p_card_id: job.card_id || null,
    p_prompt_text: spec.videoPrompt,
    p_model: spec.videoModel,
    p_aspect_ratio: spec.aspectRatio,
    p_image_size: spec.resolution,
    p_credits_spent: spec.credits,
    p_input_photo_paths: [],
    p_vibe_id: null,
    p_client_source: "site",
    p_pipeline_trace_id: job.pipeline_trace_id || null,
    p_create_ugc: false,
    p_parent_generation_id: job.id,
    p_edit_instruction: null,
    p_modality: "video",
    p_duration_seconds: spec.durationSeconds,
  })) as { data: unknown; error: { message: string } | null };
  if (error) {
    return { generationId: null, error: error.message };
  }
  const generationId = enqueueRowId(data);
  return {
    generationId: generationId || null,
    error: generationId ? null : "followup_enqueue_empty",
  };
}
