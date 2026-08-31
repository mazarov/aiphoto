import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer, getStoragePublicUrl } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { resolveSharedDbUserId } from "@/lib/resolve-db-user-id";
import {
  detachTerminalGenerationChildren,
  findGenerationIdsWithActiveChildren,
  landingGenerationsOwnerOrFilter,
  removeGenerationResultObjects,
} from "@/lib/landing-generations-access";
import { resolvePhotoshootUserFacingResult } from "@/lib/photoshoot";
import {
  enqueueListingVideoRepeatFollowup,
  parseListingVideoRepeatSpec,
} from "@/lib/listing-video-repeat";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);

    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const supabase = createSupabaseServer();
    const resolved = await resolveSharedDbUserId(supabase, user);
    const dbUserId = resolved?.dbUserId ?? user.id;
    const { data: gen, error } = await supabase
      .from("landing_generations")
      .select("*")
      .eq("id", id)
      .or(landingGenerationsOwnerOrFilter(user.id, dbUserId))
      .single();

    if (error || !gen) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const status = gen.status as string;
    let progress = 0;
    if (status === "pending") progress = 10;
    else if (status === "processing") progress = 50;
    else if (status === "completed") progress = 100;
    else if (status === "failed") progress = 0;

    const result: Record<string, unknown> = {
      id: gen.id,
      status,
      progress,
      model: gen.model,
      aspectRatio: gen.aspect_ratio,
      modality: gen.modality || "image",
      resultMimeType: gen.result_mime_type || null,
      durationSeconds: gen.duration_seconds ?? null,
      editKind: gen.edit_kind || null,
      sceneRootId: gen.scene_root_id || null,
      cameraPose: gen.camera_pose || null,
      photoshootPlan: gen.photoshoot_plan || null,
      parentGenerationId: gen.parent_generation_id || null,
      createdAt: gen.created_at,
      attemptCount: Number(gen.attempts || 0),
      maxAttempts: Number(gen.max_attempts || 3),
      nextAttemptAt: gen.next_attempt_at,
    };

    if (status === "completed" && gen.result_storage_bucket) {
      const facing = resolvePhotoshootUserFacingResult({
        editKind: gen.edit_kind,
        sheetPath: gen.result_storage_path,
        tilePaths: gen.photoshoot_tile_paths,
      });
      result.completedAt = gen.generation_completed_at;
      if (facing.resultPath) {
        result.resultUrl = getStoragePublicUrl(gen.result_storage_bucket, facing.resultPath);
      }
      if (facing.tilePaths) {
        result.photoshootTileUrls = facing.tilePaths.map((path) =>
          getStoragePublicUrl(gen.result_storage_bucket, path),
        );
      }
    }

    if (status === "failed") {
      result.errorType = gen.error_type;
      result.errorMessage = gen.error_message;
      result.creditsRefunded = Boolean(gen.credits_refunded);
    }

    const listingRepeatSpec = parseListingVideoRepeatSpec(gen.pipeline_spec);
    if (listingRepeatSpec && (gen.modality || "image") !== "video") {
      result.pipelineSpec = listingRepeatSpec;
      const { data: child } = await supabase
        .from("landing_generations")
        .select("id,status")
        .eq("parent_generation_id", gen.id)
        .eq("modality", "video")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      let followup = child;
      if (!followup && status === "completed") {
        const enqueued = await enqueueListingVideoRepeatFollowup(supabase, {
          id: gen.id,
          user_id: gen.user_id,
          requester_auth_user_id: gen.requester_auth_user_id,
          card_id: gen.card_id,
          pipeline_trace_id: gen.pipeline_trace_id,
          pipeline_spec: gen.pipeline_spec,
        });
        if (enqueued.generationId) {
          followup = { id: enqueued.generationId, status: "pending" };
        }
      }
      result.followupGenerationId = followup?.id ?? null;
      result.followupStatus = followup?.status ?? null;
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("generations/[id] error:", err);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);

    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const supabase = createSupabaseServer();
    const resolved = await resolveSharedDbUserId(supabase, user);
    const dbUserId = resolved?.dbUserId ?? user.id;

    const { data: gen, error: fetchError } = await supabase
      .from("landing_generations")
      .select("id, result_storage_bucket, result_storage_path, photoshoot_tile_paths")
      .eq("id", id)
      .or(landingGenerationsOwnerOrFilter(user.id, dbUserId))
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!gen) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const activeParents = await findGenerationIdsWithActiveChildren(supabase, [gen.id]);
    if (activeParents.has(gen.id)) {
      return NextResponse.json(
        {
          error: "generation_in_use",
          message: "Эта генерация используется для создания следующей версии",
        },
        { status: 409 }
      );
    }
    await detachTerminalGenerationChildren(supabase, [gen.id]);

    const { error: deleteError } = await supabase
      .from("landing_generations")
      .delete()
      .eq("id", gen.id);

    if (deleteError) {
      console.error("generations/[id] delete error:", deleteError);
      if (deleteError.code === "23503") {
        return NextResponse.json(
          {
            error: "generation_in_use",
            message: "Эта генерация используется для создания следующей версии",
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }

    await removeGenerationResultObjects(supabase, [gen]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("generations/[id] DELETE error:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
