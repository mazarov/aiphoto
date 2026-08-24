import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import {
  parseEnabledGenerationModels,
  parseEnabledVideoGenerationModels,
} from "@/lib/generation-model-labels";
import { isVideoAnimateUnlocked, resolveVideoModelId } from "@/lib/video-generation-contract";
import { isCameraOrbitUnlocked, resolveCameraOrbitModel } from "@/lib/camera-orbit-access";
import {
  DEFAULT_IMAGE_ASPECT_RATIO,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_VIDEO_ASPECT_RATIO,
  DEFAULT_VIDEO_DURATION_SECONDS,
  DEFAULT_VIDEO_MODEL,
  DEFAULT_VIDEO_RESOLUTION,
  IMAGE_ASPECT_RATIO_OPTIONS,
  IMAGE_GENERATION_MODALITY,
  IMAGE_SIZE_OPTIONS,
  VIDEO_ASPECT_RATIO_OPTIONS,
  VIDEO_DURATION_OPTIONS,
  VIDEO_GENERATION_MODALITY,
  VIDEO_QUANTITY,
  VIDEO_RESOLUTION_OPTIONS,
  isGenerationModality,
} from "@/lib/generation/image-options";

export async function GET(req: NextRequest) {
  try {
    const modality =
      req.nextUrl.searchParams.get("modality") || IMAGE_GENERATION_MODALITY;
    if (!isGenerationModality(modality)) {
      return NextResponse.json(
        { error: "unsupported_modality" },
        { status: 400 }
      );
    }

    const { user } = await getSupabaseUserForApiRoute(req);
    const supabase = createSupabaseServer();
    const { data: rows } = await supabase
      .from("landing_generation_config")
      .select("key, value")
      .in("key", [
        "models",
        "default_model",
        "default_aspect_ratio",
        "default_image_size",
        "max_photos",
        "max_file_size_mb",
        "min_prompt_length",
        "video_models",
        "video_animate_enabled",
        "default_video_model",
        "camera_orbit_enabled",
        "camera_orbit_model",
      ]);

    const config: Record<string, string> = {};
    for (const row of rows || []) {
      config[row.key] = row.value;
    }

    if (modality === VIDEO_GENERATION_MODALITY) {
      const models = parseEnabledVideoGenerationModels(config.video_models);
      return NextResponse.json({
        modality: VIDEO_GENERATION_MODALITY,
        enabled: isVideoAnimateUnlocked(config.video_animate_enabled, user?.email),
        models,
        aspectRatios: VIDEO_ASPECT_RATIO_OPTIONS,
        durations: VIDEO_DURATION_OPTIONS,
        resolutions: VIDEO_RESOLUTION_OPTIONS,
        imageSizes: VIDEO_RESOLUTION_OPTIONS,
        defaults: {
          model: resolveVideoModelId(
            DEFAULT_VIDEO_MODEL,
            models.map((item) => item.id)
          ),
          aspectRatio: DEFAULT_VIDEO_ASPECT_RATIO,
          imageSize: DEFAULT_VIDEO_RESOLUTION,
          durationSeconds: DEFAULT_VIDEO_DURATION_SECONDS,
        },
        limits: {
          maxPhotos: 1,
          quantity: VIDEO_QUANTITY,
          minPromptLength: parseInt(config.min_prompt_length || "8", 10),
        },
      });
    }

    const models = parseEnabledGenerationModels(config.models);
    const cameraOrbitModel = resolveCameraOrbitModel(config.camera_orbit_model, models);

    return NextResponse.json({
      modality: IMAGE_GENERATION_MODALITY,
      cameraOrbitEnabled: isCameraOrbitUnlocked(
        config.camera_orbit_enabled,
        user?.email,
      ),
      cameraOrbitModel,
      models,
      aspectRatios: IMAGE_ASPECT_RATIO_OPTIONS,
      imageSizes: IMAGE_SIZE_OPTIONS,
      defaults: {
        model: config.default_model || "gemini-2.5-flash-image",
        aspectRatio:
          config.default_aspect_ratio || DEFAULT_IMAGE_ASPECT_RATIO,
        imageSize: config.default_image_size || DEFAULT_IMAGE_SIZE,
      },
      limits: {
        maxPhotos: parseInt(config.max_photos || "4", 10),
        maxFileSizeMb: parseInt(config.max_file_size_mb || "10", 10),
        minPromptLength: parseInt(config.min_prompt_length || "8", 10),
      },
    });
  } catch (err) {
    console.error("generation-config error:", err);
    return NextResponse.json({ error: "config failed" }, { status: 500 });
  }
}
