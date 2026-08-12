import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAdmin } from "@/lib/analytics-admin";
import {
  buildAdminEnqueueIdentity,
  normalizeAdminIdempotencyBase,
  resolveAdminGenerationModel,
} from "@/lib/admin-generation-enqueue";
import { getAdminPinnedPhotoPath } from "@/lib/admin-generation-photo";
import { ensureLandingUserForGeneration } from "@/lib/ensure-landing-user";
import { createSupabaseServer } from "@/lib/supabase";
import {
  DEFAULT_IMAGE_ASPECT_RATIO,
  DEFAULT_IMAGE_SIZE,
  isImageAspectRatio,
  isImageSize,
} from "@/lib/generation/image-options";

export async function POST(req: NextRequest) {
  const gate = await requireAnalyticsAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  try {
    const body = await req.json() as {
      prompt?: string; model?: string; aspectRatio?: string; imageSize?: string;
      count?: number; idempotencyKey?: string;
    };
    const prompt = String(body.prompt || "").trim();
    const aspectRatio = body.aspectRatio || DEFAULT_IMAGE_ASPECT_RATIO;
    const imageSize = body.imageSize || DEFAULT_IMAGE_SIZE;
    const count = body.count ?? 1;
    if (prompt.length < 8) return NextResponse.json({ error: "prompt_too_short" }, { status: 400 });
    if (!Number.isInteger(count) || count < 1 || count > 4) {
      return NextResponse.json({ error: "invalid_count" }, { status: 400 });
    }
    if (!isImageAspectRatio(aspectRatio) || !isImageSize(imageSize)) {
      return NextResponse.json({ error: "invalid_generation_config" }, { status: 400 });
    }

    const supabase = createSupabaseServer();
    const [photoPath, userResult, configResult] = await Promise.all([
      getAdminPinnedPhotoPath(supabase),
      ensureLandingUserForGeneration(supabase, gate.user),
      supabase.from("landing_generation_config").select("key,value").in("key", ["models", "default_model"]),
    ]);
    if (!photoPath) return NextResponse.json({ error: "pinned_photo_required" }, { status: 409 });
    if (!userResult.ok) {
      return NextResponse.json({ error: userResult.error, message: userResult.message }, { status: userResult.status });
    }
    if (configResult.error) {
      throw new Error(`generation_config_failed:${configResult.error.message}`);
    }
    let models: Array<{ id: string; enabled?: boolean }> = [];
    const config = Object.fromEntries((configResult.data || []).map((row) => [row.key, row.value]));
    try {
      const parsed = JSON.parse(config.models || "[]");
      models = Array.isArray(parsed) ? parsed : [];
    } catch {
      models = [];
    }
    const model = resolveAdminGenerationModel(models, body.model, config.default_model);
    if (!model) {
      return NextResponse.json(
        { error: body.model ? "invalid_model" : "generation_model_unavailable" },
        { status: body.model ? 400 : 503 },
      );
    }

    const suppliedKey = (req.headers.get("Idempotency-Key") || body.idempotencyKey || "").trim();
    const baseKey = normalizeAdminIdempotencyBase(suppliedKey, `admin:${randomUUID()}`);
    if (!baseKey) {
      return NextResponse.json({ error: "invalid_idempotency_key" }, { status: 400 });
    }
    const ids: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const { idempotencyKey, fingerprint } = buildAdminEnqueueIdentity({
        baseKey, index, requesterAuthUserId: gate.userId, dbUserId: userResult.dbUserId,
        prompt, model, aspectRatio, imageSize, photoPath,
      });
      const { data, error } = await supabase.rpc("landing_enqueue_generation", {
        p_user_id: userResult.dbUserId,
        p_requester_auth_user_id: gate.userId,
        p_idempotency_key: idempotencyKey,
        p_request_fingerprint: fingerprint,
        p_card_id: null,
        p_prompt_text: prompt,
        p_model: model,
        p_aspect_ratio: aspectRatio,
        p_image_size: imageSize,
        p_credits_spent: 0,
        p_input_photo_paths: [photoPath],
        p_vibe_id: null,
        p_client_source: "admin",
        p_pipeline_trace_id: `admin-${randomUUID()}`,
        p_create_ugc: true,
        p_parent_generation_id: null,
        p_edit_instruction: null,
      });
      const row = Array.isArray(data) ? data[0] : data;
      const id = row && typeof row === "object" && "generation_id" in row ? String(row.generation_id) : "";
      if (error || !id) throw new Error(`enqueue_failed:${error?.message || "missing_id"}`);
      ids.push(id);
    }
    console.info("[admin.generate] queued", {
      adminEmail: gate.email, requesterAuthUserId: gate.userId, dbUserId: userResult.dbUserId,
      count: ids.length, generationIds: ids,
    });
    return NextResponse.json({ ids }, { status: 202 });
  } catch (error) {
    console.error("[admin.generate] failed", {
      adminEmail: gate.email, message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "generation_enqueue_failed" }, { status: 500 });
  }
}
