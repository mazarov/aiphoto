import { createHash } from "node:crypto";
import {
  LISTING_VIDEO_REPEAT_KIND,
  listingVideoRepeatFollowupIdempotencyKey,
  parseListingVideoRepeatSpec,
  type ListingVideoRepeatImageJob,
} from "./listing-video-repeat";

/** Duck-typed so worker tsc does not resolve landing's @supabase/supabase-js. */
export type ListingVideoRepeatEnqueueClient = {
  rpc: (fn: string, args: Record<string, unknown>) => unknown;
};

function enqueueRowId(data: unknown): string {
  const row = Array.isArray(data) ? data[0] : data;
  if (row && typeof row === "object" && "generation_id" in row) {
    return String((row as { generation_id: unknown }).generation_id || "");
  }
  return "";
}

/** Server/worker only. Do not import from client components — uses node:crypto. */
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
