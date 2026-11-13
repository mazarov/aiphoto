import { NextRequest, NextResponse } from "next/server";
import { serializeUnknownError } from "@/lib/analyze-history";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import {
  parseEnabledGenerationModels,
  parseEnabledVideoGenerationModels,
} from "@/lib/generation-model-labels";
import { FALLBACK_COMPOSER_DEFAULTS } from "@/lib/generation-preferences";
import {
  isMissingPreferencesTable,
  isMissingPreserveOutfitColumn,
  isMissingVideoPreferenceColumns,
  loadPreferencesRow,
  mapPreferencesRow,
} from "@/lib/generation-preferences-server";
import { readGenerationConfigMap } from "@/lib/generation-config-cache";
import {
  clampImageSizeForModel,
  isImageAspectRatio,
  isImageSize,
  isVideoAspectRatio,
} from "@/lib/generation/image-options";
import {
  normalizeVideoDurationSeconds,
  resolveVideoModelId,
} from "@/lib/video-generation-contract";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PreferencesBody = {
  model?: unknown;
  aspectRatio?: unknown;
  imageSize?: unknown;
  selectedPhotoIds?: unknown;
  videoModel?: unknown;
  videoAspectRatio?: unknown;
  videoDurationSeconds?: unknown;
  preserveOutfit?: unknown;
};

export async function GET(req: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);
    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const supabase = createSupabaseServer();
    const { data, error } = await loadPreferencesRow(supabase, user.id);

    if (error) {
      if (isMissingPreferencesTable(error)) {
        console.warn("[generation-preferences] table missing, using defaults");
        return NextResponse.json({ preferences: null });
      }
      console.error("[generation-preferences] read failed", serializeUnknownError(error));
      return NextResponse.json({ error: "preferences_failed" }, { status: 500 });
    }

    return NextResponse.json({ preferences: mapPreferencesRow(data) });
  } catch (err) {
    console.error("[generation-preferences] read error", err);
    return NextResponse.json({ error: "preferences_failed" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);
    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as PreferencesBody;
    const requestedPhotoIds = Array.isArray(body.selectedPhotoIds)
      ? [
          ...new Set(
            body.selectedPhotoIds.filter(
              (id): id is string => typeof id === "string" && UUID_RE.test(id)
            )
          ),
        ]
      : [];

    if (requestedPhotoIds.length > 10) {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }

    const supabase = createSupabaseServer();
    const [configMap, { data: ownedPhotos, error: photosError }] =
      await Promise.all([
        readGenerationConfigMap(supabase),
        requestedPhotoIds.length
          ? supabase
              .from("landing_user_photos")
              .select("id")
              .eq("auth_user_id", user.id)
              .in("id", requestedPhotoIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

    if (photosError) {
      console.error("[generation-preferences] validation lookup failed", {
        photosError: photosError.message,
      });
      return NextResponse.json({ error: "preferences_failed" }, { status: 500 });
    }

    const imageModels = parseEnabledGenerationModels(configMap.models);
    const videoModels = parseEnabledVideoGenerationModels(configMap.video_models);
    const imageIds = imageModels.map((item) => item.id);
    const videoIds = videoModels.map((item) => item.id);
    const ownedIdSet = new Set((ownedPhotos ?? []).map((photo) => photo.id));
    const selectedPhotoIds = requestedPhotoIds.filter((id) => ownedIdSet.has(id));

    const requestedModel = typeof body.model === "string" ? body.model.trim() : "";
    const model = imageIds.includes(requestedModel)
      ? requestedModel
      : imageIds[0] || FALLBACK_COMPOSER_DEFAULTS.model;
    if (!model || !imageIds.includes(model)) {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }

    const aspectRatio = isImageAspectRatio(body.aspectRatio)
      ? body.aspectRatio
      : FALLBACK_COMPOSER_DEFAULTS.aspectRatio;
    const imageSize = clampImageSizeForModel(
      model,
      isImageSize(body.imageSize) ? body.imageSize : FALLBACK_COMPOSER_DEFAULTS.imageSize
    );
    const videoModel =
      resolveVideoModelId(
        typeof body.videoModel === "string" ? body.videoModel.trim() : "",
        videoIds
      ) || FALLBACK_COMPOSER_DEFAULTS.videoModel;
    const videoAspectRatio = isVideoAspectRatio(body.videoAspectRatio)
      ? body.videoAspectRatio
      : FALLBACK_COMPOSER_DEFAULTS.videoAspectRatio;
    const videoDurationSeconds = normalizeVideoDurationSeconds(
      body.videoDurationSeconds,
      videoModel
    );
    const preserveOutfit = body.preserveOutfit === true;
    const updatedAt = new Date().toISOString();

    const fullRow = {
      auth_user_id: user.id,
      model,
      aspect_ratio: aspectRatio,
      image_size: imageSize,
      selected_photo_ids: selectedPhotoIds,
      video_model: videoModel,
      video_aspect_ratio: videoAspectRatio,
      video_duration_seconds: videoDurationSeconds,
      preserve_outfit: preserveOutfit,
      updated_at: updatedAt,
    };
    const videoRow = {
      auth_user_id: user.id,
      model,
      aspect_ratio: aspectRatio,
      image_size: imageSize,
      selected_photo_ids: selectedPhotoIds,
      video_model: videoModel,
      video_aspect_ratio: videoAspectRatio,
      video_duration_seconds: videoDurationSeconds,
      updated_at: updatedAt,
    };
    const coreRow = {
      auth_user_id: user.id,
      model,
      aspect_ratio: aspectRatio,
      image_size: imageSize,
      selected_photo_ids: selectedPhotoIds,
      updated_at: updatedAt,
    };

    let { error } = await supabase
      .from("landing_generation_preferences")
      .upsert(fullRow, { onConflict: "auth_user_id" });

    if (error && isMissingPreserveOutfitColumn(error) && !isMissingVideoPreferenceColumns(error)) {
      const retry = await supabase
        .from("landing_generation_preferences")
        .upsert(videoRow, { onConflict: "auth_user_id" });
      error = retry.error;
    }

    if (error && isMissingVideoPreferenceColumns(error)) {
      const retry = await supabase
        .from("landing_generation_preferences")
        .upsert(coreRow, { onConflict: "auth_user_id" });
      error = retry.error;
    }

    if (error) {
      if (isMissingPreferencesTable(error)) {
        console.warn("[generation-preferences] table missing, skip persist");
        return NextResponse.json({ ok: true, persisted: false });
      }
      console.error("[generation-preferences] write failed", serializeUnknownError(error));
      return NextResponse.json({ error: "preferences_failed" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      preferences: {
        model,
        aspectRatio,
        imageSize,
        selectedPhotoIds,
        videoModel,
        videoAspectRatio,
        videoDurationSeconds,
        preserveOutfit,
        updatedAt,
      },
    });
  } catch (err) {
    console.error("[generation-preferences] write error", err);
    return NextResponse.json({ error: "preferences_failed" }, { status: 500 });
  }
}
